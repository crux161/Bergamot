defmodule Hermes.MixProject do
  use Mix.Project

  def project do
    [
      app: :hermes,
      version: "0.1.0",
      elixir: "~> 1.16",
      start_permanent: Mix.env() == :prod,
      deps: deps(),
      docs: [
        main: "Hermes",
        extras: ["README.md"]
      ]
    ]
  end

  def application do
    [
      mod: {Hermes.Application, []},
      extra_applications: [:logger, :runtime_tools]
    ]
  end

  defp deps do
    [
      {:phoenix, "~> 1.7"},
      {:plug_cowboy, "~> 2.6"},
      {:phoenix_pubsub, "~> 2.1"},
      {:jason, "~> 1.4"},
      {:bandit, "~> 1.5"},
      {:websock_adapter, "~> 0.5"},
      {:jose, "~> 1.11"},
      {:brod, "~> 4.0"},
      {:telemetry, "~> 1.0"},
      {:telemetry_metrics, "~> 1.0"},
      {:dns_cluster, "~> 0.1"},
      {:ex_doc, "~> 0.34", only: :dev, runtime: false}
    ]
  end
end
