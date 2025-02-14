import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import {
  Modal,
  Button,
  notification,
  Radio,
  InputNumber,
  List,
  Row,
  Col,
  Progress,
  Spin,
} from "antd";
import { AddressInput, Address, Balance } from "../components";
import { SimpleStreamABI } from "../contracts/external_ABI";
import { useHistory } from "react-router";
import { Link } from "react-router-dom";

const STREAMS_CACHE_TTL_MILLIS=Number.parseInt(process.env.REACT_APP_STREAMS_CACHE_TTL_MILLIS) || 43200000; // 12h ttl by default
// the actual cache
const streamsCache = {};

class CachedValue {
  constructor(value) {
    this.value = value;
    this.updatedAt = Date.now();
  }

  isStale = () => {
    return (this.updatedAt + STREAMS_CACHE_TTL_MILLIS) <= Date.now();
  }
}

async function resolveStreamSummary(streamAddress, mainnetProvider) {
  const cachedStream = streamsCache[streamAddress];
  if (cachedStream && cachedStream instanceof CachedValue && !cachedStream.isStale()) {
    return cachedStream.value;
  }

  var contract = new ethers.Contract(
    streamAddress,
    SimpleStreamABI,
    mainnetProvider
  );

  var data = {};

  // Call it's cap function
  await contract
    .cap()
    .then((result) =>
      data.cap = Number(result._hex) * 0.000000000000000001
    );

  // Call it's Balance function, calculate the current percentage
  await contract
    .streamBalance()
    .then(
      (result) =>
      (data.percent =
        ((Number(result._hex) * 0.000000000000000001) / data.cap) * 100)
    );

  streamsCache[streamAddress] = new CachedValue(data);
  return data;
}

export default function Home({
  mainnetProvider,
  tx,
  writeContracts,
  readContracts,
  streams,
  ...props
}) {
  const history = useHistory();
  const [amount, setAmount] = useState(1);
  const [userAddress, setUserAddress] = useState("");
  const [duration, setDuration] = useState(4);
  const [startFull, setStartFull] = useState(0);
  const [newStreamModal, setNewStreamModal] = useState(false);
  const [ready, setReady] = useState(false);

  const [sData, setData] = useState([]);

  useEffect(() => {
    let shouldCancel = false;
    const fetchStreams = async () => {
      // parallely load all available streams data
      Promise.all(
        streams.map(async (stream) => {
          const summary = await resolveStreamSummary(stream.stream, mainnetProvider);
          return { ...stream, 3: summary.cap, percent: summary.percent };
        })
      ).then(results => {
        // process promised streams only when this effect call is not cancelled.
        if (!shouldCancel) {
          setData(results);

          // Wait until list is almost fully loaded to render
          if (results.length >= 18) {
            setReady(true);
          }
        }
      });
    }

    fetchStreams()
      .catch(console.error);

    // cleanup callback
    return () => shouldCancel = true;
  }, [streams]);

  const createNewStream = async () => {
    const capFormatted = ethers.utils.parseEther(`${amount || "1"}`);
    const frequencyFormatted = ethers.BigNumber.from(`${duration || 1}`).mul(
      "604800"
    );
    const _startFull = startFull === 1;
    const GTCContractAddress = readContracts && readContracts.GTC.address;

    const result = tx(
      writeContracts &&
        writeContracts.StreamFactory.createStreamFor(
          userAddress,
          capFormatted,
          frequencyFormatted,
          _startFull,
          GTCContractAddress
        ),
      async (update) => {
        console.log("📡 Transaction Update:", update);
        if (update && (update.status === "confirmed" || update.status === 1)) {
          console.log(" 🍾 Transaction " + update.hash + " finished!");
          console.log(
            " ⛽️ " +
              update.gasUsed +
              "/" +
              (update.gasLimit || update.gas) +
              " @ " +
              parseFloat(update.gasPrice) / 1000000000 +
              " gwei"
          );
          // reset form to default values
          setUserAddress("");
          setAmount(1);
          setDuration(4);
          setStartFull(0);

          // close stream modal
          setNewStreamModal(false);

          // send notification of stream creation
          notification.success({
            message: "New GTC Stream created",
            description: `Stream is now available for ${userAddress}`,
            placement: "topRight",
          });
        }
      }
    );
    console.log("awaiting metamask/web3 confirm result...", result);
    console.log(await result);
  };

  return (
    <div
      style={{
        width: 600,
        margin: "20px auto",
        padding: 20,
        paddingBottom: 50,
      }}
    >
      <Button
        style={{ marginTop: 20 }}
        type="primary"
        onClick={() => setNewStreamModal(true)}
      >
        Create New Stream
      </Button>
      {newStreamModal && (
        <Modal
          centered
          title="Create new stream"
          visible={newStreamModal}
          onOk={createNewStream}
          onCancel={() => setNewStreamModal(false)}
        >
          <div style={{ marginBottom: 5 }}>Recipient:</div>
          <AddressInput
            ensProvider={mainnetProvider}
            value={userAddress}
            onChange={(a) => setUserAddress(a)}
          />
          <div style={{ marginBottom: 25 }} />
          <div style={{ display: "flex", flex: 1, flexDirection: "row" }}>
            <div style={{ flex: 1, flexDirection: "column" }}>
              <div style={{ marginBottom: 5 }}>GTC Amount:</div>
              <InputNumber
                placeholder="Amount"
                min={1}
                value={amount}
                onChange={(v) => setAmount(v)}
                style={{ width: "100%" }}
              />
            </div>
            <div style={{ marginLeft: 10, marginRight: 10 }} />
            <div style={{ flex: 1, flexDirection: "column" }}>
              <div style={{ marginBottom: 5 }}>Frequency in weeks:</div>
              <InputNumber
                placeholder="Duration"
                min={1}
                value={duration}
                onChange={(d) => setDuration(d)}
                style={{ width: "100%" }}
              />
            </div>
            <div style={{ marginLeft: 10, marginRight: 10 }} />
            <div style={{ flex: 1, flexDirection: "column" }}>
              <div style={{ marginBottom: 5 }}>Start full:</div>
              <Radio.Group
                onChange={(e) => setStartFull(e.target.value)}
                value={startFull}
              >
                <Radio value={1}>Yes</Radio>
                <Radio value={0}>No</Radio>
              </Radio.Group>
            </div>
          </div>
        </Modal>
      )}

      {ready ? (
        <div style={{ marginTop: 30 }}>
          <List
            bordered
            dataSource={sData}
            renderItem={(item) => (
              <Row>
                <div
                    style={{
                      width: "110%",
                      position: "relative",
                      display: "flex",
                      flex: 1,
                      padding: 15,
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                >{"  "}
                  <Col span={10} >
                    <div
                      style={{
                        display: "flex",
                      }}
                    >
                      <Address
                        value={item[1]}
                        ensProvider={mainnetProvider}
                        fontSize={18}
                        style={{ display: "flex", flex: 1, alignItems: "center" }}
                      />{"  "}
                    </div>
                  </Col>
                  <Col span={4}>
                    <Link to={`/user/${item[1]}`}>View Stream</Link>{"  "}
                  </Col>
                  <Col span={5}>
                    <Address
                      value={item[2]}
                      ensProvider={mainnetProvider}
                      fontSize={10}
                      style={{
                        paddingLeft: 30,
                        paddingRight: 30,
                        flex: 0.3,
                        alignItems: "center",
                      }}
                    />{"  "}
                  </Col>
                  <Col span={3}>
                    <Progress
                      style={{ alignItems: "right" }}
                      type="dashboard"
                      showInfo={true}
                      width={40}
                      fontSize={1}
                      percent={item.percent}
                      format={(percent) => `${percent.toFixed(0)}%`}
                    />
                  </Col>
                </div>
              </Row>
            )}
          />
        </div>
      ) : (
        <div style={{ marginTop: 30 }}>
          <Spin tip="Loading Streams... (This may take a moment)" />
        </div>
      )}
    </div>
  );
}
