#!/usr/bin/env node
//
// couchjs client
//
// Copyright 2011 Iris Couch
//
//    Licensed under the Apache License, Version 2.0 (the "License");
//    you may not use this file except in compliance with the License.
//    You may obtain a copy of the License at
//
//        http://www.apache.org/licenses/LICENSE-2.0
//
//    Unless required by applicable law or agreed to in writing, software
//    distributed under the License is distributed on an "AS IS" BASIS,
//    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//    See the License for the specific language governing permissions and
//    limitations under the License.

var fs = require('fs')
var util = require('util')
var optimist = require('optimist')
var child_process = require('child_process')

var client = require('./client')
var LineStream = require('couchjs/stream')


var opts = optimist.usage('$0 </path/to/couchjs> </path/to/main.js>')
                   .describe('confirm=<path>', 'Path to a log file to test')


function toSource() {
  if(typeof this == 'function')
    return '' + this

  if(this instanceof Error)
    return this.stack

  return util.inspect(this)
}

function main() {
  var couchjs_filename = opts.argv._[0]
    , main_js = opts.argv._[1]

  if(opts.argv.help)
    return console.log(opts.help())

  if(!main_js || !couchjs_filename)
    return console.error(opts.help())

  console.log('%j %j', couchjs_filename, main_js)

  var child = child_process.spawn(couchjs_filename, [main_js], {'stdio':'pipe'})

  child.on('exit', function(code) {
    console.log('couchjs %s exit: %s', child.pid, code)
  })

  child.stderr.on('data', function(body) {
    console.error('couchjs %s error: %s', child.pid, body)
  })

  // Break messages from the child into lines.
  var child_stdout = new LineStream
  child_stdout.on('data', child_line)
  child.stdout.setEncoding('utf8')
  child.stdout.pipe(child_stdout)

  function child_line(line) {
    console.log('couchjs %s: %s', child.pid, line)
  }

  if(opts.argv.confirm)
    confirm_log(child, opts.argv.confirm, function(er) {
      if(er)
        throw er
    })
    return confirm_log(child, opts.argv.confirm)

  console.log('Done')
  child.stdin.write('[]\n')
}

function confirm_log(couchjs, log_filename, callback) {
  var log = new LineStream
  log.on('data', log_line)
  log.on('end', log_end)

  var log_data = fs.createReadStream(log_filename)
  log_data.setEncoding('utf8')

  var expect = 'STDIN'
    , io_re = /^(STDIN|STDOUT) (\d+): (.*)$/

  log_data.pipe(log)

  function log_line(line) {
    var match = line.match(io_re)
    if(!match)
      return

    var direction = match[1]
      , message = JSON.parse(match[3])

    if(direction !== expect) {
      couchjs.kill()
      return callback(new Error('Expected direction '+expect+' but got ' + JSON.stringify(direction) + ': ' + line))
    }

    console.log('Log %s: %j', direction, message)

    expect = (direction === 'STDIN')
                ? 'STDOUT'
                : 'STDIN'
  }

  function log_end() {
    console.log('End of log')
    couchjs.kill()
  }
}

if(require.main === module)
  main()
