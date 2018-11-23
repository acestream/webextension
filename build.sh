#!/bin/bash

XPI_DIR=xpi
CRX_DIR=crx
BUILD_DIR=dist
TARGET=$1

if [[ "$OSTYPE" == "msys" ]]; then
    CHROME="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    ROOT=$(pwd -W)
else
    #TODO: set real path
    CHROME="/path/to/chrome"
    ROOT=$(pwd)
fi

if [ "$TARGET" == "firefox" ]; then
    echo "build firefox"
    YARN_TARGET="build:firefox"
    PACKAGE_NAME="acewebextension_unsigned.xpi"
elif [ "$TARGET" == "firefox_unlisted" ]; then
    echo "build firefox unlisted"
    YARN_TARGET="build:firefox_unlisted"
    PACKAGE_NAME="acewebextension_unlisted_unsigned.xpi"
elif [ "$TARGET" == "dev" ]; then
    echo "build dev"
    YARN_TARGET="build:dev"
    PACKAGE_NAME="acewebextension_dev.xpi"
elif [ "$TARGET" == "chrome" ]; then
    echo "build chrome"
    YARN_TARGET="build:chrome"
    PACKAGE_NAME="acewebextension.crx"
else
    echo "Usage: build.sh <firefox|firefox_unlisted|chrome|dev>"
    exit
fi

# create xpi dir
mkdir -p $XPI_DIR
mkdir -p $CRX_DIR

# recreate build dir
rm -rf $BUILD_DIR
mkdir $BUILD_DIR

# build webextension
yarn $YARN_TARGET

if [ "$TARGET" == "chrome" ]; then
    echo "Pack extension for chrome..."
    KEY_PATH=$ROOT/keys/$TARGET.pem
    if [ ! -f $KEY_PATH ]; then
        echo "Missing key: $KEY_PATH"
        exit
    fi
    "$CHROME" --pack-extension=$ROOT/$BUILD_DIR --pack-extension-key=$KEY_PATH
    mv $BUILD_DIR.crx $CRX_DIR/$PACKAGE_NAME
else
    # make xpi
    echo "Build $PACKAGE_NAME..."
    cd $BUILD_DIR
    zip -qr9DX "../$XPI_DIR/$PACKAGE_NAME" *
    cd ..
fi

# finish
echo "Done"