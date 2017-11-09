#!/bin/bash

XPI_DIR=xpi
BUILD_DIR=dist
TARGET=$1

if [ "$TARGET" == "unlisted" ]; then
    echo "build unlisted"
    NPM_TARGET="build:unlisted"
    XPI_NAME="acewebextension_unlisted.xpi"
elif [ "$TARGET" == "amo" ]; then
    echo "build amo"
    NPM_TARGET="build:amo"
    XPI_NAME="acewebextension.xpi"
elif [ "$TARGET" == "dev" ]; then
    echo "build dev"
    NPM_TARGET="build:dev"
    XPI_NAME="acewebextension_dev.xpi"
else
    echo "Usage: build.sh <amo|unlisted|dev>"
    exit
fi

# create xpi dir
mkdir -p $XPI_DIR

# recreate build dir
rm -rf $BUILD_DIR
mkdir $BUILD_DIR

# build webextension
npm run $NPM_TARGET

# make unlisted xpi
echo "Build $XPI_NAME..."
cd $BUILD_DIR
zip -qr9DX "../$XPI_DIR/$XPI_NAME" *
cd ..

# finish
echo "Done"