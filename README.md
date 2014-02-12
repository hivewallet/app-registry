Hive App Registry Worker/Server
============

A worker that fetches git repositories listed on [Hive App Registry Wiki page](https://github.com/hivewallet/hive-osx/wiki/App-Registry), and serves the combined manifest.json file and icon files.

The output static files are consumed by [Hive App Store](https://github.com/hivewallet/app-store)

## Usage

If you want your app listed in the App store, go ahead add it to our app registry wiki page: https://github.com/hivewallet/hive-osx/wiki/App-Registry

Make sure to [tag your releases](http://git-scm.com/book/en/Git-Basics-Tagging) as App Registry worker only list apps with their latest tagged git release.

All static files are updated every 10 minutes and image assets are cached for 10 minutes.

## Contributing

1. Fork it
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create new Pull Request
