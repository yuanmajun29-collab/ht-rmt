const cluster = require('cluster');
const os = require('os');
const config = require('./config/config');

if (cluster.isMaster) {
  const numCpus = config.get('clustering.numWorkers') || os.cpus().length;
  
  console.log(`主进程 ${process.pid} 正在启动集群`);
  console.log(`配置工作进程数目: ${numCpus}`);

  for (let i = 0; i < numCpus; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`工作进程 ${worker.process.pid} 已退出`);
    if (!worker.exitedAfterDisconnect) {
      console.log('工作进程异常退出，重启中...');
      cluster.fork();
    }
  });

  process.on('SIGTERM', () => {
    console.log('收到 SIGTERM，关闭集群...');
    for (const id in cluster.workers) {
      cluster.workers[id].kill();
    }
    process.exit(0);
  });
} else {
  require('./server');
}
