const path = require('path')
const fs = require('fs')

const getCacheDirs__ = (base, input) => {
  let cacheDirs = []

  if (typeof input === 'string') {
    cacheDirs.push(path.normalize(base + '/' + input))
  } else if (Array.isArray(input)) {
    input.map((x) => {
      cacheDirs.push(path.normalize(base + '/' + x))
    })
  } else {
    console.log(`Warning: Unsupported value in inputs. Ignoring ${input}`)
  }

  return cacheDirs
}

const getCacheDirs = (base, inputs) => {
  return [
    ...getCacheDirs__(base, inputs.img_cache_local_dir),
    ...getCacheDirs__(base, inputs.img_cache_remote_dir),
    ...getCacheDirs__(base, inputs.other_cache_dir),
  ]
}

const getHttpHeaders = (inputs) => {
  let httpHeader = ''

  getCacheDirs__('.', inputs.img_cache_local_dir).map((x) => {
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

    const cacheDirs = getCacheDirs(constants.PUBLISH_DIR, inputs)
    cacheDirs.map((x) => {
      if (fs.existsSync(x)) {
        console.log(
          `Warning: directory ${x} already exists before restoring caches. It will be replaced if it exists in the cache.`,
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
    const cacheDirs = getCacheDirs(constants.PUBLISH_DIR, inputs)

    if (await utils.cache.save(cacheDirs)) {
      console.log('Saving 11ty directories to cache:')
      cacheDirs.map((x) => {
        console.log('- ' + x)
      })

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
    } else {
      console.log(
        `Warning: Unable to save 11ty cache. Build not found or is empty. Is you publish directory set correctly? “${constants.PUBLISH_DIR}”`,
      )
    }
  },
}
