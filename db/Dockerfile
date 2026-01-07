FROM postgres:16

# If the database should be built with example data.
ARG dev=0

FROM base AS devmode-0
# Do nothing

FROM base AS devmode-1
# Copy example data file
COPY dev/x-data.sql /docker-entrypoint-initdb.d/

FROM devmode-${dev} AS final

# Setup file
COPY setup.sql /docker-entrypoint-initdb.d/
