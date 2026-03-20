# Judge runner image — contains Node.js, Playwright, and serve
FROM mcr.microsoft.com/playwright:v1.52.0-noble

WORKDIR /work

# Install pnpm, serve, and playwright test runner
RUN npm install -g pnpm@10.32.1 serve@14 @playwright/test@1.52.0

# Create non-root user for security
RUN useradd -m -s /bin/bash judge
USER judge
