#!/bin/sh

mkdir -p tmp
cd tmp
git clone https://github.com/acestream/webextension.git
tar pczf webextension.tar.gz webextension
