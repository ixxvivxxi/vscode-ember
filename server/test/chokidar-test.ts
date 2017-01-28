import * as path from 'path';
import { tmpdir } from 'os';
import { EventEmitter } from 'events';

import { expect } from 'chai';

const fs = require('fs-extra');
const chokidar = require('chokidar');

describe('chokidar', function() {
  let workDir = path.join(tmpdir(), 'chokidar-test');

  beforeEach(function() {
    fs.emptyDirSync(workDir);
  });

  afterEach(function() {
    fs.removeSync(workDir);
  });

  function withWatcher(cb: Function) {
    return withCustomWatcher({}, cb);
  }

  async function withCustomWatcher(options = {}, cb: Function) {
    let watcher = chokidar.watch(workDir, options);
    try {
      await cb(watcher);
    } finally {
      watcher.close();
    }
  }

  it('watches an empty folder', function() {
    return withWatcher(async (watcher: any) => {
      let events = await listEventsUntilReady(watcher);

      expect(events).to.have.lengthOf(1);
      expect(events).to.deep.include({ event: 'addDir', path: `${workDir}` });

      let watched = watcher.getWatched();
      expect(watched).to.deep.equal({
        [tmpdir()]: ['chokidar-test'],
        [workDir]: [],
      });
    });
  });

  it('watches a nested project structure', function() {
    fs.outputFileSync(path.join(workDir, 'a', 'ember-cli-build.js'));
    fs.outputFileSync(path.join(workDir, 'b', 'c', 'ember-cli-build.js'));

    return withWatcher(async (watcher: any) => {
      let events = await listEventsUntilReady(watcher);

      expect(events).to.have.lengthOf(6);
      expect(events).to.deep.include({ event: 'addDir', path: `${workDir}` });
      expect(events).to.deep.include({ event: 'addDir', path: `${workDir}/a` });
      expect(events).to.deep.include({ event: 'addDir', path: `${workDir}/b` });
      expect(events).to.deep.include({ event: 'addDir', path: `${workDir}/b/c` });
      expect(events).to.deep.include({ event: 'add', path: `${workDir}/a/ember-cli-build.js` });
      expect(events).to.deep.include({ event: 'add', path: `${workDir}/b/c/ember-cli-build.js` });

      let watched = watcher.getWatched();
      expect(watched).to.deep.equal({
        [tmpdir()]: ['chokidar-test'],
        [workDir]: ['a', 'b'],
        [path.join(workDir, 'a')]: ['ember-cli-build.js'],
        [path.join(workDir, 'b')]: ['c'],
        [path.join(workDir, 'b', 'c')]: ['ember-cli-build.js'],
      });
    });
  });

  it('ignores npm and bower folders', function() {
    fs.outputFileSync(path.join(workDir, 'a', 'ember-cli-build.js'));
    fs.outputFileSync(path.join(workDir, 'a', 'app', 'app.js'));
    fs.outputFileSync(path.join(workDir, 'a', 'bower_components', 'foo', 'bower.json'));
    fs.outputFileSync(path.join(workDir, 'a', 'node_modules', 'bar', 'package.json'));

    let options = {
      ignored: [
        '**/bower_components/**',
        '**/node_modules/**',
      ],
    };

    return withCustomWatcher(options, async (watcher: any) => {
      let events = await listEventsUntilReady(watcher);

      expect(events).to.have.lengthOf(7);
      expect(events).to.deep.include({ event: 'addDir', path: `${workDir}` });
      expect(events).to.deep.include({ event: 'addDir', path: `${workDir}/a` });
      expect(events).to.deep.include({ event: 'addDir', path: `${workDir}/a/app` });
      expect(events).to.deep.include({ event: 'addDir', path: `${workDir}/a/bower_components` });
      expect(events).to.deep.include({ event: 'addDir', path: `${workDir}/a/node_modules` });
      expect(events).to.deep.include({ event: 'add', path: `${workDir}/a/ember-cli-build.js` });
      expect(events).to.deep.include({ event: 'add', path: `${workDir}/a/app/app.js` });

      let watched = watcher.getWatched();
      expect(watched).to.deep.equal({
        [tmpdir()]: ['chokidar-test'],
        [workDir]: ['a'],
        [path.join(workDir, 'a')]: ['app', 'bower_components', 'ember-cli-build.js', 'node_modules'],
        [path.join(workDir, 'a', 'app')]: ['app.js'],
        [path.join(workDir, 'a', 'bower_components')]: [],
        [path.join(workDir, 'a', 'node_modules')]: [],
      });
    });
  });
});

async function listEventsUntilReady(watcher: EventEmitter) {
  let events: any[] = [];
  let listener = (event: any, path: string) => {
    events.push({ event, path });
  };

  watcher.on('all', listener);
  await readyEvent(watcher);
  watcher.removeListener('all', listener);

  return events;
}

function readyEvent(watcher: EventEmitter) {
  return new Promise(resolve => {
    watcher.once('ready', resolve);
  });
}
