# syntax=docker/dockerfile:1

################################################################################
# Use node image for base image for all stages.
FROM node:24-alpine AS base

# Install pnpm
RUN yarn global add pnpm

# Set working directory for all build stages.
WORKDIR /usr/src/app

################################################################################
# Create a stage for installing production dependecies.
FROM base AS deps

# Download dependencies as a separate step to take advantage of Docker's caching.
# Leverage a cache mount to /root/.npm to speed up subsequent builds.
# Leverage bind mounts to package.json and pnpm-lock.yaml to avoid having to copy them
# into this layer.
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=pnpm-lock.yaml,target=pnpm-lock.yaml \
    --mount=type=bind,source=pnpm-workspace.yaml,target=pnpm-workspace.yaml \
    --mount=type=cache,target=/pnpm/store \
    pnpm install --prod

################################################################################
# Create a stage for building the application.
FROM deps AS build

# Install dev dependencies for build
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=pnpm-lock.yaml,target=pnpm-lock.yaml \
    --mount=type=bind,source=pnpm-workspace.yaml,target=pnpm-workspace.yaml \
    --mount=type=cache,target=/pnpm/store \
    pnpm install

# Copy the rest of the source files into the image.
COPY . .

# Generate the Prisma client
RUN pnpm exec prisma generate

# Run the build script.
RUN pnpm build

################################################################################
# Create a new stage to run the application with minimal runtime dependencies
# where the necessary files are copied from the build stage.
FROM base AS final

ARG VERSION

# Use production node environment by default.
ENV NODE_ENV=production

# Run the application as a non-root user.
RUN chown -R node:node /usr/src/app
USER node

# Copy the production dependencies from the deps stage and also
# the built application from the build stage into the image.
COPY --from=build /usr/src/app/bundle ./bundle
COPY --from=build /usr/src/app/prisma ./prisma
COPY --from=build /usr/src/app/prisma.config.ts ./prisma.config.ts
COPY --from=build /usr/src/app/package.json ./package.json
COPY --from=build /usr/src/app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Expose current version as environment variable
ENV CURRENT_VERSION=${VERSION}

# Expose the port that the application listens on.
EXPOSE 8080

# Run the application.
CMD ["/bin/sh", "-c", "pnpm dlx prisma@7 migrate deploy && pnpm start"]
