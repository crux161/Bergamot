defmodule Hermes.Router do
  use Phoenix.Router

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/api", Hermes do
    pipe_through :api

    get "/health", HealthController, :index
  end
end
