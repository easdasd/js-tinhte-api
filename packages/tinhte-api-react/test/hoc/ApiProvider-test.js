import expect from 'expect'
import React from 'react'
import { render, unmountComponentAtNode } from 'react-dom'

import { apiFactory, apiHoc } from 'src/'
import errors from 'src/helpers/errors'

describe('hoc', () => {
  describe('ApiProvider', () => {
    let node

    beforeEach(() => {
      node = document.createElement('div')
    })

    afterEach(() => {
      unmountComponentAtNode(node)
    })

    describe('required params', () => {
      const testRequiredParam = (Component, api, internalApi) => {
        const catched = []

        try {
          apiHoc.ApiProvider(Component, api, internalApi)
        } catch (e) {
          catched.push(e)
        }

        expect(catched.length).toBe(1)
        expect(catched[0].message).toBe(errors.API_PROVIDER.REQUIRED_PARAMS_MISSING)
      }

      it('checks for Component', () => {
        const Component = null
        const api = {}
        const internalApi = {}
        testRequiredParam(Component, api, internalApi)
      })

      it('checks for api', () => {
        const Component = () => 'foo'
        const api = null
        const internalApi = {}
        testRequiredParam(Component, api, internalApi)
      })

      it('checks for internalApi', () => {
        const Component = () => 'foo'
        const api = {}
        const internalApi = null
        testRequiredParam(Component, api, internalApi)
      })
    })

    it('swallows our props', () => {
      const api = apiFactory()
      const apiConfig = {}
      const apiData = {}
      const prop = 'foo'
      const P = api.ProviderHoc((props) => <div className='P'>{JSON.stringify(props)}</div>)
      render(<P prop={prop} apiConfig={apiConfig} apiData={apiData} />, node, () => {
        expect(node.innerHTML).toContain('<div class="P">' + JSON.stringify({ prop }) + '</div>')
      })
    })

    describe('apiData prop', () => {
      const testApiData = (apiData, callback) => {
        const api = apiFactory()
        const P = api.ProviderHoc(() => <div className='P'>ok</div>)
        render(<P apiData={apiData} />, node, () => callback(api))
      }

      it('accepts non-object', () => {
        const apiData = 'bar'
        testApiData(apiData, () => {
          expect(node.innerHTML).toContain('<div class="P">ok</div')
        })
      })

      it('accepts empty object', () => {
        const apiData = {}
        testApiData(apiData, () => {
          expect(node.innerHTML).toContain('<div class="P">ok</div')
        })
      })

      describe('bad data', () => {
        const testBadData = (apiData) => {
          const api = apiFactory()

          const Child = () => 'foo'
          Child.apiFetches = { index: { uri: 'index' } }
          const C = api.ConsumerHoc(Child)

          return new Promise((resolve) => {
            const P = api.ProviderHoc(() => <C onFetched={resolve} />)
            render(<P apiData={apiData} />, node)
          }).then(() => expect(api.getFetchCount()).toBe(1))
        }

        it('fetches with non-object job data', () => {
          const apiData = { foo: 'bar' }
          return testBadData(apiData)
        })

        it('fetches with bad job data', () => {
          const apiData = { foo: { _req: 'bar' } }
          return testBadData(apiData)
        })
      })
    })

    it('renders', (done) => {
      const api = apiFactory()

      const Child = ({ test1a, test1b, test1c }) => (
        <div className='Child'>
          <div className='test1a'>{test1a ? 'ok' : 'not'}</div>
          <div className='test1b'>{test1b === 'test1b' ? 'ok' : 'not'}</div>
          <div className='test1c'>{test1c === 'test1c' ? 'ok' : 'not'}</div>
        </div>
      )
      Child.apiFetches = {
        test1a: { uri: 'index' },
        test1b: { uri: 'index', success: () => 'test1b' },
        test1c: () => ({ uri: 'index', success: () => 'test1c' }),
        noop: () => null
      }
      const C = api.ConsumerHoc(Child)
      const ChildWithoutFetch = () => 'foo'
      const ConsumerWithoutFetch = api.ConsumerHoc(ChildWithoutFetch)
      const P = api.ProviderHoc(() => <div><C /><ConsumerWithoutFetch /></div>)

      const api2 = apiFactory()
      const Child2 = ({ test2a, test2b }) => (
        <div className='Child2'>
          <div className='test2a'>{test2a ? 'ok' : 'not'}</div>
          <div className='test2b'>{test2b ? 'ok' : 'not'}</div>
        </div>
      )
      Child2.apiFetches = {
        test2a: { uri: 'index' },
        test2b: { uri: 'navigation' },
        noop2: () => null
      }
      const C2 = api2.ConsumerHoc(Child2)
      let onC2Fetched = null
      const P2 = api2.ProviderHoc(() => <C2 onFetched={onC2Fetched} />)

      expect(api.getFetchCount()).toBe(0)
      expect(api2.getFetchCount()).toBe(0)
      api.fetchApiDataForProvider(<P />)
        .then((apiData) => {
          expect(api.getFetchCount()).toBe(1)
          expect(api2.getFetchCount()).toBe(0)

          // test 1: renders from apiData
          render(<P apiData={apiData} />, node, () => {
            setTimeout(() => {
              expect(node.innerHTML).toContain('<div class="test1a">ok</div>')
              expect(node.innerHTML).toContain('<div class="test1b">ok</div>')
              expect(node.innerHTML).toContain('<div class="test1c">ok</div>')
              expect(api.getFetchCount()).toBe(1)
              expect(api2.getFetchCount()).toBe(0)

              // test 2: fetches for missing data
              onC2Fetched = () => {
                setTimeout(() => {
                  expect(node2.innerHTML).toContain('<div class="test2a">ok</div>')
                  expect(node2.innerHTML).toContain('<div class="test2b">ok</div>')
                  expect(api.getFetchCount()).toBe(1)
                  expect(api2.getFetchCount()).toBe(1)

                  unmountComponentAtNode(node2)
                  done()
                }, 10)
              }

              const node2 = document.createElement('div')
              render(<P2 apiData={apiData} />, node2)
            }, 10)
          })
        })
    })
  })
})
