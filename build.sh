#!/bin/bash

FIREFOX_OUTPUT_DIR=firefox
CHROME_OUTPUT_DIR=chrome
BUILD_DIR=dist
PACKAGE_NAME="acewebextension"
TARGET=$1

if [[ "$OSTYPE" == "msys" ]]; then
    ROOT=$(pwd -W)
else
    ROOT=$(pwd)
fi

if [ "$TARGET" == "firefox" ]; then
    echo "Build for Firefox"
    YARN_TARGET="build"
elif [ "$TARGET" == "chrome" ]; then
    echo "Build for Chrome"
    YARN_TARGET="build"
else
    echo "Usage: build.sh <firefox|chrome>"
    exit
fi

# create xpi dir
mkdir -p $FIREFOX_OUTPUT_DIR
mkdir -p $CHROME_OUTPUT_DIR

# recreate build dir
rm -rf $BUILD_DIR
mkdir $BUILD_DIR

# build webextension
yarn $YARN_TARGET

if [ "$TARGET" == "chrome" ]; then
    echo "Pack extension for Chrome ..."

    KEY_PATH=$ROOT/keys/$TARGET.pem
    if [ ! -f $KEY_PATH ]; then
        echo "Missing key: $KEY_PATH"
        exit
    fi

    cd $BUILD_DIR

    echo "Copy key file ..."
    cp $KEY_PATH key.pem

    echo "Create zip package ..."
    zip -qr9DX "../$CHROME_OUTPUT_DIR/$PACKAGE_NAME.zip" *

    echo "Remove key file after packaging"
    rm key.pem
else
    echo "Pack extension for Firefox ..."
    cd $BUILD_DIR

    echo "Create zip package ..."
    zip -qr9DX "../$FIREFOX_OUTPUT_DIR/$PACKAGE_NAME.zip" *
fi

# finish
echo "Done"