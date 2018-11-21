#!/bin/bash

XPI_DIR=xpi
BUILD_DIR=dist
TARGET=$1

if [ "$TARGET" == "unlisted" ]; then
    echo "build unlisted"
    NPM_TARGET="build:unlisted"
    XPI_NAME="acewebextension_unlisted_unsigned.xpi"
elif [ "$TARGET" == "amo" ]; then
    echo "build amo"
    NPM_TARGET="build:amo"
    XPI_NAME="acewebextension_unsigned.xpi"
elif [ "$TARGET" == "dev" ]; then
    echo "build dev"
    NPM_TARGET="build:dev"
    XPI_NAME="acewebextension_dev.xpi"
elif [ "$TARGET" == "chrome" ]; then
    echo "build chrome"
    NPM_TARGET="build:chrome"
else
    echo "Usage: build.sh <amo|unlisted|dev|chrome>"
    exit
fi

# create xpi dir
mkdir -p $XPI_DIR

# recreate build dir
rm -rf $BUILD_DIR
mkdir $BUILD_DIR

# build webextension
npm run $NPM_TARGET

if [ "$TARGET" != "chrome" ]; then
    # make xpi
    echo "Build $XPI_NAME..."
    cd $BUILD_DIR
    zip -qr9DX "../$XPI_DIR/$XPI_NAME" *
    cd ..
fi

# finish
echo "Done"