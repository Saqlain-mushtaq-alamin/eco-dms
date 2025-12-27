#!/bin/bash

# Compile the GraphQL schema into a Ceramic composite
composedb composite:create ceramic/schema.graphql --ceramic-url=http://localhost:7007 --output=ceramic/composite.json

# Deploy the composite and get the runtime definition
composedb composite:deploy ceramic/composite.json --ceramic-url=http://localhost:7007

echo "Composite compiled and deployed!"
echo "Copy the model stream ID from above and add it to your .env file as CERAMIC_POSTS_MODEL_STREAM"
