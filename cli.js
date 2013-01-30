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
var obj_diff = require('obj_diff')
var child_process = require('child_process')

var client = require('./client')
var LineStream = require('couchjs/stream')


var opts = optimist.usage('$0 </path/to/couchjs> </path/to/main.js>')
                   .describe('confirm=<path>', 'Path to a log file to test')
                   .describe('verbose', 'Display messages being passed')
                   .boolean('verbose')


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
  child.stdout_lines = new LineStream
  //child.stdout_lines.on('data', child_line)
  child.stdout.setEncoding('utf8')
  child.stdout.pipe(child.stdout_lines)
  child.stdout.pause()

  //function child_line(line) {
  //  console.log('couchjs %s: %s', child.pid, line)
  //}

  if(opts.argv.confirm)
    return confirm_log(child, opts.argv.confirm, function(er) {
      if(er)
        throw er
    })

  console.log('Done')
  child.stdin.write('[]\n')
}

function confirm_log(couchjs, log_filename, callback) {
  var log = new LineStream
  log.on('data', log_line)
  couchjs.stdout_lines.on('data', couchjs_line)

  log.on('end', log_end)
  couchjs.stdout_lines.on('end', couchjs_end)

  var log_data = fs.createReadStream(log_filename)
  log_data.setEncoding('utf8')

  var expect = 'STDIN'
    , io_re = /^(STDIN|STDOUT) (\d+): (.*)$/
    , to_couchjs = []
    , from_couchjs = []
    , from_log     = []
    , pass = {}
    , fail = {}

  log_data.pipe(log)
  couchjs.stdout.resume()

  function log_line(line) {
    var match = line.match(io_re)
    if(!match)
      return

    var direction = match[1]
      , message = match[3]

    if(direction !== expect) {
      couchjs.kill()
      return callback(new Error('Expected direction '+expect+' but got ' + JSON.stringify(direction) + ': ' + line))
    }

    //console.log('Log %s: %j', direction, message)
    if(direction === 'STDIN') {
      expect = 'STDOUT'

      try {
        message = JSON.parse(message)
      } catch (er) {
        return callback(er)
      }

      if(opts.argv.verbose)
        console.log('Send: %j', message)

      to_couchjs.push(message)
      couchjs.stdin.write(JSON.stringify(message) + '\n')
    } else if(direction === 'STDOUT') {
      expect = 'STDIN'

      from_log.push(message)
      check()
    }
  }

  function couchjs_line(line) {
    if(opts.argv.verbose)
      console.log('Recv: %j', line)

    from_couchjs.push(line)
    check()
  }

  function check() {
    if(from_couchjs.length === 0 || from_log.length === 0 || to_couchjs.length === 0)
      return

    var expect_line = from_log.shift()
      , couchjs_line = from_couchjs.shift()
      , sent_message = to_couchjs.shift()

    try {
      var expect = JSON.parse(expect_line)
        , couchjs = JSON.parse(couchjs_line)
    } catch (er) {
      return callback(er)
    }

    var is_same = is_deep_equal(expect, couchjs)
    if(is_same)
      return add_pass(sent_message)
    else
      return add_fail(message, expect, couchjs)
  }

  function add_pass(message) {
    var method = message[0]
    pass[method] = pass[method] || 0
    pass[method] += 1
  }

  function add_fail(message, expect, couchjs) {
  }

  var ended = {'log':false, 'couchjs':false}
  function log_end() {
    couchjs.stdin.end()
    ended.log = true
    wrapup()
  }

  function couchjs_end() {
    ended.couchjs = true
    wrapup()
  }

  function wrapup() {
    if(!ended.log || !ended.couchjs)
      return

    console.log('Finished running log through couchjs')
    console.log('Passes:')
    for (var method in pass)
      console.log('  %s: %s', method, pass[method])
    console.log('Fails:')
    for (var method in fail)
      console.log('  %s: %s', method, fail[method])
  }
}

function is_deep_equal(expect, obj) {
  var expect_type = typeof expect
    , obj_type = typeof obj

  if(expect_type !== obj_type) console.log('## Bad type')
  if(expect_type !== obj_type)
    return false

  if(Array.isArray(obj)) {
    if(obj.length !== expect.length) console.log('## Bad array length')
    if(obj.length !== expect.length)
      return false

    for (var i = 0; i < obj.length; i++)
      if(! is_deep_equal(expect[i], obj[i])) console.log('## Arrays do not match: %j %j', expect, obj)
      if(! is_deep_equal(expect[i], obj[i]))
        return false

    return true
  }

  if(!obj_type || !expect)
    return expect === obj

  if(obj_type === 'object') {
    var keys = Object.keys(obj)
    if(Object.keys(expect).length !== keys.length)
      return false

    for (var key in obj)
      if(! is_deep_equal(expect[key], obj[key]))
        return false

    return true
  }

  if(~['boolean', 'number'].indexOf(obj_type))
    return expect === obj

  throw new Error('Unknown type: ' + obj_type)
}

if(require.main === module)
  main()
