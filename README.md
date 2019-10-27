# huex
Personalized home lighting with HUE bulb


## Build 

Simply run `build.sh`

## Deployment

After creating the docker image, you can run it with the following

```
docker run -d -e HUE_KEY=<YOUR_KEY> \
            -e DATA_COLLECTION_INTERVAL=<IN_MILLISECONDS> \ 
            -e POSTGRES_URI=<URI_TO_POSTGRES_DB> \
            [--network=postgresdb] \
            dnguyenclincase/huex
```

Postgres needs to be created separately