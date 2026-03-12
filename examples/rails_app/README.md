# Example: Rails app

A minimal Rails app used in BoringCache examples.

## What this example is

- A Rails app with a production Dockerfile.
- Ruby version is pinned in `.ruby-version`.
- Uses SQLite3 by default.

## How to run locally

```bash
bundle install
bin/rails server
```

## How it is used in BoringCache examples

This app is referenced by the shared bundle cache example in:
- `action/README.md`
- `docker/README.md`

Set `APP_DIR=action/examples/rails_app` in those workflows.

## How to build the Docker image

```bash
cd action/examples/rails_app
docker build -t rails_app .
docker run -d -p 80:80 -e RAILS_MASTER_KEY=<value> --name rails_app rails_app
```

## Notes

- The Dockerfile is production-oriented. For dev containers, see the Rails devcontainer guide.
