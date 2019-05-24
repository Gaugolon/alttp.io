import WebpackConfigServerCreate from './server'
import NodemonWebpackPlugin from 'nodemon-webpack-plugin';
const HardSourceWebpackPlugin = require('hard-source-webpack-plugin');

const webpackConfigServer = WebpackConfigServerCreate()
webpackConfigServer.watch = true
webpackConfigServer.mode = 'development'
webpackConfigServer.devtool = 'cheap-module-eval-source-map'
webpackConfigServer.plugins.push(new HardSourceWebpackPlugin())
webpackConfigServer.plugins.push(new NodemonWebpackPlugin({
    watch: ['./dist'],
    ext: 'js,html',
    ignore: ['./dist/public/**/*', './dist/cache', './dist/config.json'],
    verbose: true,
    nodeArgs: ['--inspect=8100', '--expose-gc'],
    script: './dist/app.main.bundle.js',
}))

export default [webpackConfigServer]