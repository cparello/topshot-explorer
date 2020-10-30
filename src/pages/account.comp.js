import React, {useState, useEffect} from "react"
import {useParams} from "react-router-dom"
import {withPrefix, sansPrefix} from "../util/address.util"
import * as fcl from "@onflow/fcl"
import styled from "styled-components"
import {Table} from "react-bootstrap"
import ReactPaginate from "react-paginate"
import * as t from "@onflow/types"

const getAccount = async (address) => {
  const resp = await fcl.send([fcl.getAccount(sansPrefix(address))])
  return fcl.decode(resp)
}

const getTopshotAccount = async (address) => {
  const resp = await fcl.send([
    fcl.script`
  import TopShot from 0x${window.topshotAddress}
  import Market from 0x${window.topshotMarketAddress}
  pub struct TopshotAccount {
    pub var momentIDs: [UInt64]
    pub var saleMomentIDs: [UInt64]

    init(momentIDs: [UInt64], saleMomentIDs: [UInt64]) {
      self.momentIDs = momentIDs
      self.saleMomentIDs = saleMomentIDs
    }
  }
  pub fun main(): TopshotAccount {
  let acct = getAccount(0x${address})
  let collectionRef = acct.getCapability(/public/MomentCollection)!
                .borrow<&{TopShot.MomentCollectionPublic}>()!
  let momentIDs = collectionRef.getIDs()

  var saleMomentIDs: [UInt64] = []
  let salePublic = acct.getCapability(/public/topshotSaleCollection)
  if salePublic!.check<&{Market.SalePublic}>(){
    let saleCollectionRef = salePublic!.borrow<&{Market.SalePublic}>() ?? panic("Could not borrow capability from public collection")
    saleMomentIDs = saleCollectionRef.getIDs()  
  }

  return TopshotAccount(momentIDs: momentIDs, saleMomentIDs: saleMomentIDs)
}  `,
  ])
  return fcl.decode(resp)
}

const getMoments = async (address, momentIDs) => {
  if (momentIDs && momentIDs.length === 0) {
    return []
  }
  const resp = await fcl.send([
    fcl.script`
  import TopShot from 0x${window.topshotAddress}
  pub struct Moment {
    pub var id: UInt64?
    pub var playId: UInt32?
    pub var meta: TopShot.MomentData?
    pub var play: {String: String}?
    pub var setId: UInt32?
    pub var setName: String?
    pub var serialNumber: UInt32?
    init(_ moment: &TopShot.NFT?) {
      self.id = moment?.id
      self.meta = moment?.data
      self.playId = moment?.data?.playID
      self.play = nil
      self.play = TopShot.getPlayMetaData(playID: self.playId!)
      self.setId = moment?.data?.setID
      self.setName = nil
      self.setName = TopShot.getSetName(setID: self.setId!)
      self.serialNumber = nil
      self.serialNumber = moment?.data?.serialNumber
    }
  }
  pub fun main(momentIDs: [UInt64]): [Moment] {
  let acct = getAccount(0x${address})
  let collectionRef = acct.getCapability(/public/MomentCollection)!
                .borrow<&{TopShot.MomentCollectionPublic}>()!
    var moments: [Moment] = []
    for momentID in momentIDs {
      moments.append(Moment(collectionRef.borrowMoment(id: momentID)))
    }
    return moments
}  `,
    fcl.args([fcl.arg(momentIDs, t.Array(t.UInt64))]),
  ])
  return fcl.decode(resp)
}

const getListings = async (address, saleMomentIDs) => {
  if (saleMomentIDs && saleMomentIDs.length === 0) {
    return []
  }

  const resp = await fcl.send([
    fcl.script`
        import TopShot from 0x${window.topshotAddress}
        import Market from 0x${window.topshotMarketAddress}
        pub struct SaleMoment {
          pub var id: UInt64?
          pub var playId: UInt32?
          pub var meta: TopShot.MomentData?
          pub var play: {String: String}?
          pub var setId: UInt32?
          pub var setName: String?
          pub var serialNumber: UInt32?
          pub var price: UFix64
          init(moment: &TopShot.NFT?, price: UFix64) {
            self.id = moment?.id
            self.meta = moment?.data
            self.playId = moment?.data?.playID
            self.play = nil
            self.play = TopShot.getPlayMetaData(playID: self.playId!)
            self.setId = moment?.data?.setID
            self.setName = nil
            self.setName = TopShot.getSetName(setID: self.setId!)
            self.serialNumber = nil
            self.serialNumber = moment?.data?.serialNumber
            self.price = price
          }
        }
      
		pub fun main(momentIDs: [UInt64]): [SaleMoment] {
			let acct = getAccount(0x${address})
            let collectionRef = acct.getCapability(/public/topshotSaleCollection)!.borrow<&{Market.SalePublic}>() ?? panic("Could not borrow capability from public collection")
            var saleMoments: [SaleMoment] = []
            for momentID in momentIDs {
              saleMoments.append(SaleMoment(moment: collectionRef.borrowMoment(id: momentID),price: collectionRef.getPrice(tokenID: momentID)!))
            }
          return saleMoments
          }
  `,
    fcl.args([fcl.arg(saleMomentIDs, t.Array(t.UInt64))]),
  ])
  return fcl.decode(resp)
}

const Root = styled.div`
  font-family: monospace;
  color: #233445;
  font-size: 13px;
  padding: 21px;
`

const Muted = styled.span`
  color: #78899a;
`

const H1 = styled.h1``

export function Account() {
  const {address} = useParams()
  const [acct, setAcct] = useState(null)
  const [error, setError] = useState(null)
  const [topshotAccount, setTopShotAccount] = useState(null)

  const [momentIDs, setMomentIDs] = useState([])
  const [saleMomentIDs, setSaleMomentIDs] = useState([])

  useEffect(() => {
    getTopshotAccount(address)
      .then((d) => {
        console.log(d)
        setTopShotAccount(d)
        setMomentIDs(d.momentIDs.slice(0, 20))
        setSaleMomentIDs(d.saleMomentIDs.slice(0, 20))
      })
      .catch(setError)
  }, [address])

  useEffect(() => {
    getAccount(address).then(setAcct).catch(setError)
  }, [address])

  const [moments, setMoments] = useState(null)
  useEffect(() => {
    getMoments(address, momentIDs)
      .then((m) => {
        setMoments(m)
      })
      .catch(setError)
  }, [address, momentIDs])

  const [listings, setListings] = useState(null)
  useEffect(() => {
    getListings(address, saleMomentIDs)
      .then((l) => {
        setListings(l)
      })
      .catch(setError)
  }, [address, saleMomentIDs])

  const handlePageClick = function (data) {
    let mIDs = topshotAccount.momentIDs.slice(data.selected * 20, data.selected * 20 + 20)
    setMomentIDs(mIDs)
  }

  const handleSalePageClick = function (data) {
    let mIDs = topshotAccount.saleMomentIDs.slice(data.selected * 20, data.selected * 20 + 20)
    setSaleMomentIDs(mIDs)
  }
  if (error != null)
    return (
      <Root>
        <H1>
          <Muted>Account: </Muted>
          <span>{withPrefix(address)}</span>
        </H1>
        <h3>
          <span>Could NOT fetch info for: </span>
          <Muted>{withPrefix(address)}</Muted>
        </h3>
        <ul>
          <li>This probably means it doesn't exist</li>
        </ul>
      </Root>
    )
  if (acct == null)
    return (
      <Root>
        <H1>
          <Muted>Account: </Muted>
          <span>{withPrefix(address)}</span>
        </H1>
        <h3>
          <span>Fetching info for: </span>
          <Muted>{withPrefix(address)}</Muted>
        </h3>
      </Root>
    )
  return (
    <Root>
      <H1>
        <Muted>Account: </Muted>
        <span>{withPrefix(acct.address)}</span>
      </H1>
      <div>
        <h3>
          <span>Moments</span>
          <Muted> {topshotAccount && topshotAccount.momentIDs.length}</Muted>
        </h3>
        {/* <MomentList></MomentList> */}

        {moments && !!moments.length && (
          <div>
            <Table striped bordered hover size="sm">
              <thead>
                <tr>
                  <th>moment id</th>
                  <th>set name</th>
                  <th>player full name</th>
                  <th>serial number</th>
                </tr>
              </thead>
              <tbody>
                {moments
                  .sort((a, b) => {
                    return a.setName === b.setName ? 0 : +(a.setName > b.setName) || -1
                  })
                  .map((moment) => {
                    return (
                      <tr key={moment.id}>
                        <td>{moment.id}</td>
                        <td>{moment.setName}</td>
                        <td>{moment.play.FullName}</td>
                        <td>{moment.serialNumber}</td>
                      </tr>
                    )
                  })}
              </tbody>
            </Table>
            <ReactPaginate
              previousLabel={"<"}
              nextLabel={">"}
              breakLabel={<span className="page-link">...</span>}
              breakClassName={"page-item"}
              pageClassName="page-item"
              previousClassName="page-item"
              nextClassName="page-item"
              pageLinkClassName="page-link"
              previousLinkClassName="page-link"
              nextLinkClassName="page-link"
              pageCount={topshotAccount ? topshotAccount.momentIDs.length / 20 : 0}
              marginPagesDisplayed={2}
              pageRangeDisplayed={5}
              onPageChange={handlePageClick}
              containerClassName={"pagination"}
              subContainerClassName={"pages pagination"}
              activeClassName={"active"}
            />
          </div>
        )}
      </div>
      <div>
        <h3>
          <span>Listings</span>
          <Muted> {topshotAccount && topshotAccount.saleMomentIDs.length}</Muted>
        </h3>
        {listings && !!listings.length && (
          <div>
            <Table striped bordered hover size="sm">
              <thead>
                <tr>
                  <th>moment id</th>
                  <th>set name</th>
                  <th>player full name</th>
                  <th>serial number</th>
                  <th>price</th>
                </tr>
              </thead>
              <tbody>
                {listings
                  .sort((a, b) => {
                    return a.setName === b.setName ? 0 : +(a.setName > b.setName) || -1
                  })
                  .map((listing) => {
                    return (
                      <tr key={listing.id}>
                        <td>{listing.id}</td>
                        <td>{listing.setName}</td>
                        <td>{listing.play.FullName}</td>
                        <td>{listing.serialNumber}</td>
                        <td>{listing.price}</td>
                      </tr>
                    )
                  })}
              </tbody>
            </Table>
            <ReactPaginate
              previousLabel={"<"}
              nextLabel={">"}
              breakLabel={<span className="page-link">...</span>}
              breakClassName={"page-item"}
              pageClassName="page-item"
              previousClassName="page-item"
              nextClassName="page-item"
              pageLinkClassName="page-link"
              previousLinkClassName="page-link"
              nextLinkClassName="page-link"
              pageCount={topshotAccount ? topshotAccount.saleMomentIDs.length / 20 : 0}
              marginPagesDisplayed={2}
              pageRangeDisplayed={5}
              onPageChange={handleSalePageClick}
              containerClassName={"pagination"}
              subContainerClassName={"pages pagination"}
              activeClassName={"active"}
            />
          </div>
        )}
      </div>
    </Root>
  )
}