#!/bin/bash

FIREFOX_OUTPUT_DIR=firefox
CHROME_OUTPUT_DIR=chrome
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
    PACKAGE_NAME="acewebextension_unsigned"
elif [ "$TARGET" == "firefox_unlisted" ]; then
    echo "build firefox unlisted"
    YARN_TARGET="build:firefox_unlisted"
    PACKAGE_NAME="acewebextension_unlisted_unsigned"
elif [ "$TARGET" == "dev" ]; then
    echo "build dev"
    YARN_TARGET="build:dev"
    PACKAGE_NAME="acewebextension_dev"
elif [ "$TARGET" == "chrome" ]; then
    echo "build chrome"
    YARN_TARGET="build:chrome"
    PACKAGE_NAME="acewebextension"
else
    echo "Usage: build.sh <firefox|firefox_unlisted|chrome|dev>"
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
    echo "Pack extension for chrome..."

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

    echo "Remove key file before packaging ..."
    rm key.pem

    cd ..

    echo "Create CRX ($PACKAGE_NAME) ..."
    "$CHROME" --pack-extension=$ROOT/$BUILD_DIR --pack-extension-key=$KEY_PATH
    mv $BUILD_DIR.crx $CHROME_OUTPUT_DIR/$PACKAGE_NAME.crx
else
    # make xpi
    echo "Build XPI ($PACKAGE_NAME) ..."
    cd $BUILD_DIR
    zip -qr9DX "../$FIREFOX_OUTPUT_DIR/$PACKAGE_NAME.xpi" *
    cd ..
fi

# finish
echo "Done"