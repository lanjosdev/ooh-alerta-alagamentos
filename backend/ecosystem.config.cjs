module.exports = {
  apps: [
    {
      name: 'ooh-alerta-alagamentos-backend',
      script: 'npm',
      args: 'start',
      autorestart: true,
      restart_delay: 5000,
    },
  ],
}
