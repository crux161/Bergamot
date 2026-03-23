defmodule Hermes.Channels.UserChannel do
  @moduledoc """
  User-scoped Phoenix channel for inbox, saved-item, and badge updates.

  Topic format: "user:<user_id>"
  """

  use Phoenix.Channel

  require Logger

  @impl true
  def join("user:" <> user_id, _payload, socket) do
    if socket.assigns.user_id == user_id do
      Logger.debug("User #{user_id} joined private user channel")
      {:ok, %{user_id: user_id}, assign(socket, :private_user_topic, "user:#{user_id}")}
    else
      {:error, %{reason: "unauthorized"}}
    end
  end
end
