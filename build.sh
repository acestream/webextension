#!/bin/bash

XPI_DIR=xpi
BUILD_DIR=dist
TARGET=$1

if [ "$TARGET" == "firefox" ]; then
    echo "build firefox"
    YARN_TARGET="build:firefox"
    XPI_NAME="acewebextension_unsigned.xpi"
elif [ "$TARGET" == "firefox_unlisted" ]; then
    echo "build firefox unlisted"
    YARN_TARGET="build:firefox_unlisted"
    XPI_NAME="acewebextension_unlisted_unsigned.xpi"
elif [ "$TARGET" == "dev" ]; then
    echo "build dev"
    YARN_TARGET="build:dev"
    XPI_NAME="acewebextension_dev.xpi"
elif [ "$TARGET" == "chrome" ]; then
    echo "build chrome"
    YARN_TARGET="build:chrome"
else
    echo "Usage: build.sh <firefox|firefox_unlisted|chrome|dev>"
    exit
fi

# create xpi dir
mkdir -p $XPI_DIR

# recreate build dir
rm -rf $BUILD_DIR
mkdir $BUILD_DIR

# build webextension
yarn $YARN_TARGET

if [ "$TARGET" != "chrome" ]; then
    # make xpi
    echo "Build $XPI_NAME..."
    cd $BUILD_DIR
    zip -qr9DX "../$XPI_DIR/$XPI_NAME" *
    cd ..
fi

# finish
echo "Done"