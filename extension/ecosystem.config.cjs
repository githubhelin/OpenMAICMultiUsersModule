module.exports = {
  apps: [
    {
      name: 'openmaic',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -H 0.0.0.0 -p 3000',
      cwd: '/home/helin/projects/OpenMAIC',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
        HOSTNAME: '0.0.0.0',
      },
      max_memory_restart: '2G',
      autorestart: true,
      restart_delay: 2000,
    },
  ],
};
