defmodule Hermes.Router do
  use Phoenix.Router

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/api", Hermes do
    pipe_through :api

    get "/health", HealthController, :index
    post "/internal/broadcast", InternalController, :broadcast
    post "/internal/broadcast-many", InternalController, :broadcast_many
    post "/internal/publish", InternalController, :publish
  end
end
