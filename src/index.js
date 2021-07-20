const path = require('path')
const fs = require('fs')

const getCacheDirs = (constants, inputs) => {
  const getCacheDirs__ = (constants, input) => {
    let cacheDirs = []

    if (typeof input === 'string') {
      cacheDirs.push(path.normalize(constants.PUBLISH_DIR + '/' + input))
    } else if (Array.isArray(input)) {
      input.map((x) => {
        cacheDirs.push(path.normalize(constants.PUBLISH_DIR + '/' + x))
      })
    } else {
      console.log(`Warning: Unsupported value in inputs. Ignoring ${input}`)
    }

    return cacheDirs
  }

  return [
    ...getCacheDirs__(constants, inputs.img_cache_local_dir),
    ...getCacheDirs__(constants, inputs.img_cache_remote_dir),
    ...getCacheDirs__(constants, inputs.other_cache_dir),
  ]
}

const getHttpHeaders = (inputs) => {
  let httpHeader = ''

  inputs.img_cache_local_dir.map((x) => {
    httpHeader += `
${x}/*
cache-control: public
cache-control: max-age=31536000
cache-control: immutable

`
  })

  return httpHeader
}

module.exports = {
  async onPreBuild({ constants, inputs, utils }) {
    if (!constants.PUBLISH_DIR || process.cwd() === constants.PUBLISH_DIR) {
      utils.build.failBuild(
        `11ty sites must publish the dist directory, but your site’s publish directory is set to : “${constants.PUBLISH_DIR}”. Please set your publish directory to your 11ty site’s dist directory.`,
      )
    }

    const cacheDirs = getCacheDirs(constants, inputs)
    cacheDirs.map((x) => {
      if (fs.existsSync(x)) {
        console.log(
          `Warning: directory ${x} already exists before restoring caches. It will be replaced.`,
        )
      }
    })

    if (await utils.cache.restore(cacheDirs)) {
      console.log('Restoring 11ty directories from cache:')
      cacheDirs.map((x) => {
        console.log('- ' + x)
      })
    } else {
      console.log('No 11ty caches found. Building fresh.')
    }
  },

  async onPostBuild({ constants, inputs, utils }) {
    if (inputs.img_cache_httpHeader) {
      fs.appendFile(
        `${constants.PUBLISH_DIR}/_headers`,
        getHttpHeaders(inputs),
        (err) => {
          if (err) throw err
          console.log('Saved http header')
        },
      )
    }

    const cacheDirs = getCacheDirs(constants, inputs)

    if (await utils.cache.save(cacheDirs)) {
      console.log('Saving 11ty directories to cache:')
      cacheDirs.map((x) => {
        console.log('- ' + x)
      })
    } else {
      console.log(
        `Warning: 11ty build not found. Is you publish directory set correctly? “${constants.PUBLISH_DIR}”`,
      )
    }
  },
}
