#!/bin/sh

TARBALL_FILENAME=webextension.tar.gz

mkdir -p tmp
cd tmp

echo "Clone repo..."
git clone https://github.com/acestream/webextension.git

echo "Make tarball..."
tar pczf ${TARBALL_FILENAME} webextension
rm -rf webextension

echo "Tarball created: tmp/${TARBALL_FILENAME}"
