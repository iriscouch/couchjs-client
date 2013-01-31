# CouchJS Client

## Client to couchjs, for testing and benchmarking

CouchJS Client runs a CouchDB view server (`couchjs`) and communicates with it as if from the CouchDB program.

CouchJS Client is available as an npm module.

    $ npm install -g couchjs-client

## Usage

Install CouchDB or [CouchJS][couchjs]. Install this package with npm. Confirm your `couchjs` install location.

    couchjs-client <path/to/couchjs> <path/to/main.js>

If you use CouchJS and you have a log file, you can instruct couchjs-client to play the log through a fresh `couchjs` instance.

    $ ./cli.js `which couchjs` ../couchdb/share/server/main.js --confirm=./logs/rewrite.log 
    "./node_modules/.bin/couchjs" "../couchdb/share/server/main.js"
    Finished in 60 ms s: ./logs/rewrite.log
    Passes:
      ddoc: 7
      reset: 28
      add_fun: 8
      map_doc: 34
    Fails:

    couchjs 7999 exit: 0

## License

Apache 2.0

See the [Apache 2.0 license](named/blob/master/LICENSE).

[tap]: https://github.com/isaacs/node-tap
[def]: https://github.com/iriscouch/defaultable
[couchjs]: https://github.com/iriscouch/couchjs

couchjs-client
==============

Client to couchjs, for testing aNd benchmarking


You must have the couchjs package installed (globally).
