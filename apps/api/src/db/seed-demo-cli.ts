// Demo Seed（Product R-09、Issue #82）の実行枠。db:migrate の後に実行する。
// 合成記録の内容・投入先の分離はI-13で決めるため、ここでは未実装であることを明示して失敗させる。
console.error('db:seed:demo は未実装です（#82 Demo Seed）。db:migrate の後に実行する枠として用意しています。');
process.exit(2);
