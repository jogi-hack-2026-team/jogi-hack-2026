// No DB is created. Verify explicit assertion failure cannot be masked by exit hooks.
import 'embedded-postgres';
process.exit(1);
