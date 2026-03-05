# syntax=docker/dockerfile:1

################################################################################
# Use node image for base image for all stages.
FROM node:24-alpine AS base

# Set working directory for all build stages.
WORKDIR /usr/src/app

# Install pnpm
RUN yarn global add pnpm


################################################################################
# Create a stage for installing production dependecies.
FROM base AS deps

# Download dependencies as a separate step to take advantage of Docker's caching.
# Leverage a cache mount to /root/.npm to speed up subsequent builds.
# Leverage bind mounts to package.json and pnpm-lock.yaml to avoid having to copy them
# into this layer.
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=pnpm-lock.yaml,target=pnpm-lock.yaml \
    --mount=type=cache,target=/pnpm/store \
    pnpm install --prod

################################################################################
# Create a stage for building the application.
FROM deps AS build

# Install dev dependencies for build
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=pnpm-lock.yaml,target=pnpm-lock.yaml \
    --mount=type=cache,target=/pnpm/store \
    pnpm install

# Copy the rest of the source files into the image.
COPY . .

# Generate the Prisma client
RUN npx prisma generate

# Run the build script.
RUN pnpm build

################################################################################
# Create a new stage to run the application with minimal runtime dependencies
# where the necessary files are copied from the build stage.
FROM base AS final

# Use production node environment by default.
ENV NODE_ENV=production

# Run the application as a non-root user.
RUN chown -R node:node /usr/src/app
USER node

# Copy package.json so that package manager commands can be used.
COPY package.json pnpm-lock.yaml .

# Install Prisma
RUN --mount=type=cache,target=/pnpm/store \
    pnpm add prisma

# Copy the production dependencies from the deps stage and also
# the built application from the build stage into the image.
COPY --from=build /usr/src/app/bundle ./bundle
COPY --from=build /usr/src/app/prisma ./prisma
COPY --from=build /usr/src/app/prisma.config.ts ./prisma.config.ts

# Expose the port that the application listens on.
EXPOSE 8080

# Run the application.
CMD ["/bin/sh", "-c", "pnpm exec prisma migrate deploy && pnpm start"]
