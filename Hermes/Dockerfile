FROM elixir:1.16-otp-26-alpine AS build

RUN apk add --no-cache git build-base

WORKDIR /hermes

ENV MIX_ENV=prod

# Install hex + rebar
RUN mix local.hex --force && mix local.rebar --force

# Install deps
COPY mix.exs ./
RUN mix deps.get --only prod
RUN mix deps.compile

# Copy app source
COPY config config
COPY lib lib

RUN mix compile
RUN mix release

# --- Runtime ---
FROM alpine:3.19 AS runtime

RUN apk add --no-cache libstdc++ openssl ncurses-libs

WORKDIR /hermes

COPY --from=build /hermes/_build/prod/rel/hermes ./

ENV PHX_SERVER=true

EXPOSE 4000

CMD ["bin/hermes", "start"]
