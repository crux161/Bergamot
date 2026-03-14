defmodule Hermes.Socket.JWT do
  @moduledoc """
  Verifies JWT tokens shared with Janus (the Identity Service).
  Uses the same HS256 secret so tokens minted by Janus are valid here.
  """

  @doc """
  Verifies and decodes a JWT string.

  Returns `{:ok, %{user_id: user_id}}` on success or
  `{:error, reason}` where reason is `:token_expired`,
  `:invalid_signature`, or `:invalid_token`.
  """
  @spec verify(String.t()) :: {:ok, map()} | {:error, atom()}
  def verify(token) do
    secret = Application.get_env(:hermes, :jwt_secret, "CHANGE-ME-in-production-use-openssl-rand-hex-32")
    jwk = JOSE.JWK.from_oct(secret)

    case JOSE.JWT.verify_strict(jwk, ["HS256"], token) do
      {true, %JOSE.JWT{fields: %{"sub" => user_id} = fields}, _jws} ->
        # Check expiration
        case Map.get(fields, "exp") do
          nil ->
            {:ok, %{user_id: user_id}}

          exp when is_number(exp) ->
            now = System.system_time(:second)

            if now < exp do
              {:ok, %{user_id: user_id}}
            else
              {:error, :token_expired}
            end
        end

      {false, _jwt, _jws} ->
        {:error, :invalid_signature}

      {:error, _reason} ->
        {:error, :invalid_token}
    end
  end
end
