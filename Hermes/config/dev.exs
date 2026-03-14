import Config

config :hermes, Hermes.Endpoint,
  http: [ip: {0, 0, 0, 0}, port: 4000],
  check_origin: false,
  code_reloader: false,
  debug_errors: true,
  secret_key_base: String.duplicate("dev_secret_", 8),
  server: true

config :logger, level: :debug
