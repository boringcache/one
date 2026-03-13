#!/usr/bin/env bash
set -euo pipefail

command="${1:-}"
case_id="${2:-}"
workdir="${3:-}"

if [[ -z "$command" || -z "$case_id" || -z "$workdir" ]]; then
  echo "usage: $0 <prepare> <case-id> <workdir>" >&2
  exit 1
fi

reset_workdir() {
  rm -rf "$workdir"
  mkdir -p "$workdir"
}

prepare_archive_compat_node() {
  cat >"$workdir/package.json" <<'EOF'
{
  "name": "archive-compat-node",
  "private": true,
  "dependencies": {
    "is-number": "7.0.0"
  }
}
EOF
}

prepare_node_pnpm() {
  cat >"$workdir/package.json" <<'EOF'
{
  "name": "node-pnpm-e2e",
  "private": true,
  "packageManager": "pnpm@10.12.1",
  "dependencies": {
    "is-odd": "3.0.1"
  }
}
EOF
}

prepare_node_yarn() {
  cat >"$workdir/package.json" <<'EOF'
{
  "name": "node-yarn-e2e",
  "private": true,
  "packageManager": "yarn@1.22.22",
  "dependencies": {
    "is-even": "1.0.0"
  }
}
EOF
}

prepare_ruby() {
  mkdir -p "$workdir/.bundle"
  cat >"$workdir/.bundle/config" <<'EOF'
---
BUNDLE_PATH: "vendor/bundle"
EOF
  cat >"$workdir/Gemfile" <<'EOF'
source 'https://rubygems.org'

gem 'rake', '~> 13.2'
EOF
  cat >"$workdir/Rakefile" <<'EOF'
task :default do
  puts 'ruby-e2e-ok'
end
EOF
}

prepare_rails_preset() {
  mkdir -p "$workdir/.bundle"
  cat >"$workdir/.bundle/config" <<'EOF'
---
BUNDLE_PATH: "vendor/bundle"
EOF
  cat >"$workdir/.ruby-version" <<'EOF'
3.3.7
EOF
  cat >"$workdir/.node-version" <<'EOF'
20.19.0
EOF
  cat >"$workdir/Gemfile" <<'EOF'
source 'https://rubygems.org'

gem 'rake', '~> 13.2'
EOF
  cat >"$workdir/Rakefile" <<'EOF'
task :default do
  puts 'rails-preset-ruby-ok'
end
EOF
  cat >"$workdir/package.json" <<'EOF'
{
  "name": "rails-preset-e2e",
  "private": true,
  "dependencies": {
    "is-number": "7.0.0"
  }
}
EOF
}

prepare_python() {
  cat >"$workdir/requirements.txt" <<'EOF'
click==8.1.8
EOF
  cat >"$workdir/app.py" <<'EOF'
import click

if __name__ == "__main__":
    click.echo("python-e2e-ok")
EOF
}

prepare_go() {
  cat >"$workdir/go.mod" <<'EOF'
module example.com/boringcache-one-go

go 1.23

require github.com/google/uuid v1.6.0
EOF
  cat >"$workdir/main.go" <<'EOF'
package main

import (
	"fmt"

	"github.com/google/uuid"
)

func main() {
	fmt.Printf("go-e2e-ok:%d\n", len(uuid.NewString()))
}
EOF
  cat >"$workdir/main_test.go" <<'EOF'
package main

import "testing"

func TestSmoke(t *testing.T) {}
EOF
}

prepare_java_maven() {
  mkdir -p "$workdir/src/main/java/com/example"
  mkdir -p "$workdir/src/test/java/com/example"
  cat >"$workdir/pom.xml" <<'EOF'
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>boringcache-one-java</artifactId>
  <version>0.1.0</version>
  <properties>
    <maven.compiler.source>21</maven.compiler.source>
    <maven.compiler.target>21</maven.compiler.target>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    <junit.version>5.11.4</junit.version>
  </properties>
  <dependencies>
    <dependency>
      <groupId>org.junit.jupiter</groupId>
      <artifactId>junit-jupiter</artifactId>
      <version>${junit.version}</version>
      <scope>test</scope>
    </dependency>
  </dependencies>
  <build>
    <plugins>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-surefire-plugin</artifactId>
        <version>3.5.2</version>
      </plugin>
    </plugins>
  </build>
</project>
EOF
  cat >"$workdir/src/main/java/com/example/App.java" <<'EOF'
package com.example;

public class App {
  public static String message() {
    return "java-maven-e2e-ok";
  }

  public static void main(String[] args) {
    System.out.println(message());
  }
}
EOF
  cat >"$workdir/src/test/java/com/example/AppTest.java" <<'EOF'
package com.example;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class AppTest {
  @Test
  void smoke() {
    assertEquals("java-maven-e2e-ok", App.message());
  }
}
EOF
}

prepare_elixir() {
  mkdir -p "$workdir/lib"
  mkdir -p "$workdir/test"
  cat >"$workdir/mix.exs" <<'EOF'
defmodule OneE2e.MixProject do
  use Mix.Project

  def project do
    [
      app: :one_e2e,
      version: "0.1.0",
      elixir: "~> 1.17",
      start_permanent: Mix.env() == :prod,
      deps: deps()
    ]
  end

  def application do
    [
      extra_applications: [:logger]
    ]
  end

  defp deps do
    [
      {:jason, "~> 1.4"}
    ]
  end
end
EOF
  cat >"$workdir/lib/one_e2e.ex" <<'EOF'
defmodule OneE2e do
  def message do
    Jason.encode!(%{status: "elixir-e2e-ok"})
  end
end
EOF
  cat >"$workdir/test/test_helper.exs" <<'EOF'
ExUnit.start()
EOF
  cat >"$workdir/test/one_e2e_test.exs" <<'EOF'
defmodule OneE2eTest do
  use ExUnit.Case, async: true

  test "encodes the status" do
    assert OneE2e.message() == ~s({"status":"elixir-e2e-ok"})
  end
end
EOF
}

prepare_docker() {
  cat >"$workdir/Dockerfile" <<'EOF'
FROM alpine:3.20
WORKDIR /app
COPY message.txt /app/message.txt
CMD ["cat", "/app/message.txt"]
EOF
  cat >"$workdir/message.txt" <<'EOF'
docker-mode-ok
EOF
}

prepare_buildkit() {
  cat >"$workdir/Dockerfile" <<'EOF'
FROM alpine:3.20
WORKDIR /app
COPY message.txt /app/message.txt
RUN sha256sum /app/message.txt > /app/message.sha256
CMD ["cat", "/app/message.sha256"]
EOF
  cat >"$workdir/message.txt" <<'EOF'
buildkit-mode-ok
EOF
}

prepare_bazel() {
  cat >"$workdir/.bazelversion" <<'EOF'
8.1.1
EOF
  cat >"$workdir/.bazelrc" <<'EOF'
common --enable_bzlmod=false
common --enable_workspace=true
EOF
  cat >"$workdir/WORKSPACE" <<'EOF'
workspace(name = "boringcache_one_bazel")
EOF
  cat >"$workdir/BUILD.bazel" <<'EOF'
sh_binary(
    name = "hello",
    srcs = ["hello.sh"],
)
EOF
  cat >"$workdir/hello.sh" <<'EOF'
#!/usr/bin/env bash
echo bazel-mode-ok
EOF
  chmod +x "$workdir/hello.sh"
}

prepare_gradle_mode() {
  mkdir -p "$workdir/src/main/java/com/example"
  mkdir -p "$workdir/src/test/java/com/example"
  cat >"$workdir/.java-version" <<'EOF'
21
EOF
  cat >"$workdir/settings.gradle" <<'EOF'
rootProject.name = 'boringcache-one-gradle'
EOF
  cat >"$workdir/build.gradle" <<'EOF'
plugins {
  id 'java'
}

repositories {
  mavenCentral()
}

dependencies {
  testImplementation 'org.junit.jupiter:junit-jupiter:5.11.4'
}

test {
  useJUnitPlatform()
}
EOF
  cat >"$workdir/src/main/java/com/example/App.java" <<'EOF'
package com.example;

public class App {
  public static String message() {
    return "gradle-mode-ok";
  }
}
EOF
  cat >"$workdir/src/test/java/com/example/AppTest.java" <<'EOF'
package com.example;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class AppTest {
  @Test
  void smoke() {
    assertEquals("gradle-mode-ok", App.message());
  }
}
EOF
}

prepare_rust_sccache() {
  mkdir -p "$workdir/src"
  cat >"$workdir/rust-toolchain.toml" <<'EOF'
[toolchain]
channel = "1.86.0"
EOF
  cat >"$workdir/Cargo.toml" <<'EOF'
[package]
name = "boringcache-one-rust"
version = "0.1.0"
edition = "2021"

[dependencies]
serde_json = "1.0"
EOF
  cat >"$workdir/src/main.rs" <<'EOF'
fn main() {
    println!("{}", serde_json::json!({ "status": "rust-sccache-mode-ok" }));
}
EOF
}

prepare_turbo_proxy() {
  mkdir -p "$workdir/packages/app"
  cat >"$workdir/.node-version" <<'EOF'
20.19.0
EOF
  cat >"$workdir/package.json" <<'EOF'
{
  "name": "turbo-proxy-e2e",
  "private": true,
  "packageManager": "npm@10.8.2",
  "workspaces": [
    "packages/*"
  ],
  "devDependencies": {
    "turbo": "2.4.2"
  }
}
EOF
  cat >"$workdir/turbo.json" <<'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "outputs": [
        "dist/**"
      ]
    }
  }
}
EOF
  cat >"$workdir/packages/app/package.json" <<'EOF'
{
  "name": "@one-e2e/app",
  "private": true,
  "scripts": {
    "build": "node build.js"
  }
}
EOF
  cat >"$workdir/packages/app/build.js" <<'EOF'
const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, 'dist');
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'output.txt'), 'turbo-proxy-mode-ok\n');
console.log('turbo-proxy-mode-ok');
EOF
}

prepare_case() {
  reset_workdir
  case "$case_id" in
    archive-compat-node) prepare_archive_compat_node ;;
    node-pnpm) prepare_node_pnpm ;;
    node-yarn) prepare_node_yarn ;;
    ruby) prepare_ruby ;;
    rails-preset) prepare_rails_preset ;;
    python) prepare_python ;;
    go) prepare_go ;;
    java-maven|maven) prepare_java_maven ;;
    elixir) prepare_elixir ;;
    docker) prepare_docker ;;
    buildkit) prepare_buildkit ;;
    bazel) prepare_bazel ;;
    gradle) prepare_gradle_mode ;;
    rust-sccache) prepare_rust_sccache ;;
    turbo-proxy) prepare_turbo_proxy ;;
    *)
      echo "unknown case: $case_id" >&2
      exit 1
      ;;
  esac
}

case "$command" in
  prepare)
    prepare_case
    ;;
  *)
    echo "unsupported command: $command" >&2
    exit 1
    ;;
esac
