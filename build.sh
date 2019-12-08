#!/bin/bash

docker build --no-cache -t dnguyenclincase/huex:latest .
docker tag dnguyenclincase/huex:latest dnguyenclincase/huex:0.1.0