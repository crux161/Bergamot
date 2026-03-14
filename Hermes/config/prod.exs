import Config

config :hermes, Hermes.Endpoint,
  http: [ip: {0, 0, 0, 0}, port: 4000],
  check_origin: true,
  server: true

config :logger, level: :info
