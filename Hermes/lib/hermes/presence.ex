defmodule Hermes.Presence do
  @moduledoc """
  Phoenix Presence tracker for voice rooms.

  Automatically broadcasts `"presence_diff"` events when users join or
  leave a voice channel, enabling the UI to display a live participant
  list without polling.
  """

  use Phoenix.Presence,
    otp_app: :hermes,
    pubsub_server: Hermes.PubSub
end
