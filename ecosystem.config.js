module.exports = {
  apps: [
    {
      name: 'artistwebsite',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/home/arx-app/backends/artistwebsite',
      env: {
        NODE_ENV: 'production',
        PORT: 5094,
      },
    },
  ],
};