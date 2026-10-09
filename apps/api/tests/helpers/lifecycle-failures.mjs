// 障害注入は、この子プロセスが獲得した合成資源だけに適用する。
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { createTestDatabase } from './database.ts';
import { setup, startStack } from './stack.ts';
const { Pool } = pg;
if (process.argv[2] === 'embedded-start') {
    const { default: EmbeddedPostgres } = await import('embedded-postgres');
    const start = EmbeddedPostgres.prototype.start;
    const failure = new Error('after-real-start');
    let directory, pid;
    EmbeddedPostgres.prototype.start = async function () {
        directory = this.options.databaseDir;
        await start.call(this);
        pid = Number(readFileSync(join(directory, 'postmaster.pid'), 'utf8').split('\n')[0]);
        throw failure;
    };
    try {
        await assert.rejects(createTestDatabase(), error => error === failure);
    }
    finally {
        EmbeddedPostgres.prototype.start = start;
    }
    await assertStopped(directory, pid);
    console.log(JSON.stringify({ scenarios: 1 }));
}
else {
    const owner = await createTestDatabase();
    const directory = (await owner.pool.query("select current_setting('data_directory') as dir")).rows[0].dir;
    const pid = Number(readFileSync(join(directory, 'postmaster.pid'), 'utf8').split('\n')[0]);
    try {
        if (process.argv[2] === 'database') {
            for (const scenario of ['create', 'application-construction', 'application-close', 'admin-close']) {
                let name, dropped = false, adminEnded = false, appEnded = false, stopped = 0;
                const failure = new Error(scenario);
                let calls = 0;
                const createPool = (options) => {
                    calls++;
                    if (calls === 2 && scenario === 'application-construction')
                        throw failure;
                    const pool = new Pool(options);
                    const query = pool.query.bind(pool), end = pool.end.bind(pool);
                    if (calls === 1) {
                        pool.query = async (...args) => {
                            if (String(args[0]).startsWith('create database')) {
                                name = /"([^"]+)"/.exec(args[0])[1];
                                if (scenario === 'create')
                                    throw failure;
                            }
                            return query(...args);
                        };
                        pool.end = async () => {
                            dropped = (await query('select count(*)::int as n from pg_database where datname=$1', [name])).rows[0].n === 0;
                            await end();
                            adminEnded = true;
                            if (scenario === 'admin-close')
                                throw failure;
                        };
                    }
                    else {
                        pool.end = async () => { await end(); appEnded = true; if (scenario === 'application-close')
                            throw failure; };
                    }
                    return pool;
                };
                if (scenario === 'create' || scenario === 'application-construction') {
                    await assert.rejects(createTestDatabase({ createPool, connectAdmin: async () => ({ url: owner.connectionString, stop: async () => { stopped++; } }) }), error => error === failure);
                }
                else {
                    const db = await createTestDatabase({ createPool, connectAdmin: async () => ({ url: owner.connectionString, stop: async () => { stopped++; } }) });
                    await db.pool.query('select 1');
                    await assert.rejects(db.close(), error => error === failure);
                    await assert.rejects(db.close(), error => error === failure);
                    assert.equal(appEnded, true);
                }
                assert.equal(adminEnded, true);
                assert.equal(dropped, true);
                assert.equal(stopped, 1, 'admin終了が失敗してもstopを試行し二重実行しない');
            }
            console.log(JSON.stringify({ scenarios: 4 }));
        }
        else if (process.argv[2] === 'stack') {
            for (const scenario of ['migration', 'auth', 'build', 'close']) {
                let hook, dbCloses = 0, authEnds = 0;
                const initial = new Error(scenario);
                const appFailure = new Error('app-close'), authFailure = new Error('auth-close'), dbFailure = new Error('db-close');
                const factories = {
                    createTestDatabase: async () => {
                        const db = await createTestDatabase({ connectAdmin: async () => ({ url: owner.connectionString, stop: async () => { } }) });
                        const close = db.close;
                        db.close = async () => { dbCloses++; await close(); if (scenario === 'close')
                            throw dbFailure; };
                        return db;
                    },
                    startStack: async (db, options) => {
                        let authPool;
                        const overrides = {
                            createAuthPool: (config) => {
                                authPool = new Pool(config);
                                const end = authPool.end.bind(authPool);
                                authPool.end = async () => { await end(); authEnds++; if (scenario === 'close')
                                    throw authFailure; };
                                return authPool;
                            },
                        };
                        if (scenario === 'auth')
                            overrides.createAuth = () => { throw initial; };
                        if (scenario === 'build')
                            overrides.buildApp = async () => { await authPool.query('select 1'); throw initial; };
                        const stack = await startStack(db, options, overrides);
                        if (scenario === 'close') {
                            await authPool.query('select 1');
                            const close = stack.app.close.bind(stack.app);
                            stack.app.close = async () => { await close(); throw appFailure; };
                        }
                        return stack;
                    },
                };
                if (scenario === 'migration')
                    factories.migrate = async () => { assert.ok(hook); throw initial; };
                const context = { after: callback => { hook = callback; } };
                if (scenario === 'close') {
                    await setup(context, {}, factories);
                    await assert.rejects(hook(), error => {
                        assert.deepEqual(error.errors.flatMap(e => e instanceof AggregateError ? e.errors : [e]), [appFailure, authFailure, dbFailure]);
                        return true;
                    });
                }
                else {
                    await assert.rejects(setup(context, {}, factories), error => error === initial);
                    await hook();
                }
                assert.equal(dbCloses, 1, '失敗即時とafterで二重closeしない');
                assert.equal(authEnds, scenario === 'migration' ? 0 : 1);
            }
            console.log(JSON.stringify({ scenarios: 4 }));
        }
        else {
            throw new Error('Unknown failure scenario group');
        }
    }
    finally {
        await owner.close();
    }
    await assertStopped(directory, pid);
}
async function assertStopped(directory, pid) {
    assert.equal(existsSync(join(directory, 'postmaster.pid')), false);
    const deadline = Date.now() + 5000;
    const alive = () => { try {
        process.kill(pid, 0);
        return true;
    }
    catch (e) {
        if (e.code !== 'ESRCH')
            throw e;
        return false;
    } };
    while (alive() && Date.now() < deadline)
        await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(alive(), false, '所有postmasterが終了する');
}
