defmodule Hermes.Endpoint do
  @moduledoc """
  Phoenix Endpoint for Hermes.

  Exposes a WebSocket at `/socket` for real-time channel connections
  and a JSON-only plug pipeline for any REST health-check routes.
  """

  use Phoenix.Endpoint, otp_app: :hermes

  socket "/socket", Hermes.Socket.UserSocket,
    websocket: [timeout: 45_000],
    longpoll: false

  plug Plug.Parsers,
    parsers: [:json],
    pass: ["application/json"],
    json_decoder: Jason

  plug Hermes.Router
end
