# Example: Next.js app

A minimal Next.js app used for BoringCache examples and local testing.

## What this example is

- Created with `create-next-app`.
- Uses Yarn (see `yarn.lock`).
- Includes a production Dockerfile.

## How to run locally

```bash
yarn install
yarn dev
```

Open http://localhost:3000 in your browser.

## How to build the Docker image

```bash
docker build -t nextjs_app ./actions/action/examples/nextjs_app
docker run -p 3000:3000 --name nextjs_app nextjs_app
```

## Notes

- This app is intentionally minimal and not production-hardened.
- For real projects, use your app's README.
