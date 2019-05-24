import Webpack from 'webpack'
import * as path from 'path'

function WebpackConfigServerCreate(): Webpack.Configuration {
    const config: Webpack.Configuration = {
        name: 'ALTTP.IO-Server',
        mode: "development",
        target: 'node',
        entry: {
            'main': './src/main.ts'
        },
        output: {
            path: path.resolve('./dist'),
            filename: 'app.[name].bundle.js',
        },
        resolve: {
            modules: ['node_modules'],
            extensions: ['.ts', '.js', '.node'],
            mainFields: [
                'module',
                'main',
            ],
            alias: {
                "/build/Release/opencv4nodejs": "native-ext-loader!./opencv4nodejs.node",
                "../build/Release/opencv4nodejs": "native-ext-loader!./opencv4nodejs.node",
                "./build/Release/opencv4nodejs": "native-ext-loader!./opencv4nodejs.node",
                "\\build\\Release\\opencv4nodejs": "native-ext-loader!./opencv4nodejs.node"
            }
        },
        externals: {

        },
        module: {
            noParse: [
                /aws/,
            ],
            rules: [
                {
                    test: /\.js?$/,
                    use: [
                        'babel-loader',
                        'file-loader',
                    ],
                    exclude: /node_modules/,
                },
                {
                    test: /\.ts$/,
                    exclude: [
                        /\.d.ts?$/,
                        /\.spec.ts?$/,
                        /node_modules/
                    ],
                    use: [
                        'babel-loader',
                        {
                            loader: 'awesome-typescript-loader',
                            options: {
                                configFileName: 'tsconfig.json',
                                useCache: true,
                                forceIsolatedModules: true,
                                reportFiles: true,
                            }
                        },
                    ],
                },
                {
                    test: /\.node$/,
                    loader: "native-ext-loader",
                    options: {
                        // rewritePath: path.resolve(__dirname, "."),
                        // emit: true,
                    }
                },
            ]
        },
        plugins: []

    }
    return config
}

export default WebpackConfigServerCreate