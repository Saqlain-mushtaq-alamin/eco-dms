# PowerShell script to compile Ceramic schema

Write-Host "Compiling Ceramic schema..." -ForegroundColor Green

# Compile the GraphQL schema into a Ceramic composite
npx @composedb/cli composite:create ceramic/schema.graphql --ceramic-url=http://localhost:7007 --output=ceramic/composite.json

# Deploy the composite and get the runtime definition
npx @composedb/cli composite:deploy ceramic/composite.json --ceramic-url=http://localhost:7007

Write-Host "`nComposite compiled and deployed!" -ForegroundColor Green
Write-Host "Copy the model stream ID from above and add it to your .env file as CERAMIC_POSTS_MODEL_STREAM" -ForegroundColor Yellow
