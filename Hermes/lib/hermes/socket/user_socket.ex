defmodule Hermes.Socket.UserSocket do
  @moduledoc """
  Phoenix Socket that authenticates users via JWT.

  Maps all `"channel:*"` topics to `Hermes.Channels.ChatChannel`.
  The client must supply a valid JWT as `params.token` when connecting.
  """

  use Phoenix.Socket

  alias Hermes.Socket.JWT

  # All "channel:<channel_id>" topics route to ChatChannel
  channel "channel:*", Hermes.Channels.ChatChannel

  # Voice/video room signaling — "voice:<room_id>"
  channel "voice:*", Hermes.Channels.VoiceChannel

  @doc """
  Authenticate the socket connection using a JWT token.
  The client passes it as: `new Socket("/socket", {params: {token: "..."}})`.
  """
  @impl true
  def connect(%{"token" => token}, socket, _connect_info) do
    case JWT.verify(token) do
      {:ok, %{user_id: user_id}} ->
        {:ok, assign(socket, :user_id, user_id)}

      {:error, _reason} ->
        :error
    end
  end

  def connect(_params, _socket, _connect_info), do: :error

  @doc """
  Returns a unique socket identifier based on the authenticated user ID.
  """
  @impl true
  def id(socket), do: "user_socket:#{socket.assigns.user_id}"
end
