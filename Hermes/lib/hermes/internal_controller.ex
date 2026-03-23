defmodule Hermes.InternalController do
  use Phoenix.Controller, formats: [:json]

  alias Hermes.Endpoint
  alias Hermes.Kafka.Producer

  plug :authorize_internal

  def broadcast(conn, %{"user_id" => user_id, "event" => event} = params) do
    payload = Map.get(params, "payload", %{})
    Endpoint.broadcast("user:#{user_id}", event, payload)
    json(conn, %{status: "ok", delivered_to: [user_id], event: event})
  end

  def broadcast_many(conn, %{"user_ids" => user_ids, "event" => event} = params) when is_list(user_ids) do
    payload = Map.get(params, "payload", %{})

    Enum.each(user_ids, fn user_id ->
      Endpoint.broadcast("user:#{user_id}", event, payload)
    end)

    json(conn, %{status: "ok", delivered_to: user_ids, event: event})
  end

  def broadcast_many(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> json(%{detail: "user_ids must be provided as a list"})
  end

  def publish(conn, %{"partition_key" => partition_key, "event" => event} = params) when is_map(event) do
    topic = Map.get(params, "topic", "bergamot.activity")

    case Producer.publish_event(topic, partition_key, event) do
      :ok ->
        json(conn, %{status: "ok", topic: topic, partition_key: partition_key})

      {:error, reason} ->
        conn
        |> put_status(:bad_gateway)
        |> json(%{detail: "publish failed", reason: inspect(reason)})
    end
  end

  def publish(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> json(%{detail: "partition_key and event are required"})
  end

  defp authorize_internal(conn, _opts) do
    expected_secret = Application.get_env(:hermes, :internal_broadcast_secret, "bergamot-hermes-internal-dev")
    provided_secret =
      conn
      |> get_req_header("x-hermes-internal-secret")
      |> List.first()

    if provided_secret == expected_secret do
      conn
    else
      conn
      |> put_status(:unauthorized)
      |> json(%{detail: "invalid internal broadcast secret"})
      |> halt()
    end
  end
end
