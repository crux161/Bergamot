#!/bin/sh

cd Proteus
npm run build && electron-forge package
