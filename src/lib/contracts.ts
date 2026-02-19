// Contract addresses (update after deployment)
export const CONTRACT_ADDRESSES = {
  matchRegistry: (process.env.NEXT_PUBLIC_MATCH_REGISTRY_ADDRESS || '0x0') as `0x${string}`,
  daoToken: (process.env.NEXT_PUBLIC_DAO_TOKEN_ADDRESS || '0x0') as `0x${string}`,
};

// Match Registry ABI (minimal - add full ABI after compilation)
export const MATCH_REGISTRY_ABI = [
  {
    "inputs": [
      {"internalType": "address", "name": "_daoToken", "type": "address"},
      {"internalType": "uint32", "name": "_yesThreshold", "type": "uint32"},
      {"internalType": "uint32", "name": "_noThreshold", "type": "uint32"},
      {"internalType": "uint64", "name": "_voteDurationSeconds", "type": "uint64"}
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "userB", "type": "address"},
      {"internalType": "bytes32", "name": "aiScoreHash", "type": "bytes32"},
      {"internalType": "bytes32", "name": "metadataHash", "type": "bytes32"}
    ],
    "name": "proposeMatch",
    "outputs": [{"internalType": "uint256", "name": "matchId", "type": "uint256"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "matchId", "type": "uint256"},
      {"internalType": "bool", "name": "support", "type": "bool"}
    ],
    "name": "vote",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "matchId", "type": "uint256"}],
    "name": "finalize",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "matchId", "type": "uint256"}],
    "name": "getProposal",
    "outputs": [
      {
        "components": [
          {"internalType": "address", "name": "userA", "type": "address"},
          {"internalType": "address", "name": "userB", "type": "address"},
          {"internalType": "bytes32", "name": "aiScoreHash", "type": "bytes32"},
          {"internalType": "bytes32", "name": "metadataHash", "type": "bytes32"},
          {"internalType": "uint64", "name": "createdAt", "type": "uint64"},
          {"internalType": "uint64", "name": "deadline", "type": "uint64"},
          {"internalType": "uint32", "name": "yesVotes", "type": "uint32"},
          {"internalType": "uint32", "name": "noVotes", "type": "uint32"},
          {"internalType": "enum MatchRegistry.Status", "name": "status", "type": "uint8"}
        ],
        "internalType": "struct MatchRegistry.MatchProposal",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "matchId", "type": "uint256"}],
    "name": "isMatchApproved",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "matchId", "type": "uint256"},
      {"internalType": "address", "name": "voter", "type": "address"}
    ],
    "name": "canVote",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "matchId", "type": "uint256"},
      {"indexed": true, "internalType": "address", "name": "userA", "type": "address"},
      {"indexed": true, "internalType": "address", "name": "userB", "type": "address"},
      {"indexed": false, "internalType": "bytes32", "name": "aiScoreHash", "type": "bytes32"},
      {"indexed": false, "internalType": "bytes32", "name": "metadataHash", "type": "bytes32"},
      {"indexed": false, "internalType": "uint64", "name": "deadline", "type": "uint64"}
    ],
    "name": "MatchProposed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "matchId", "type": "uint256"},
      {"indexed": true, "internalType": "address", "name": "voter", "type": "address"},
      {"indexed": false, "internalType": "bool", "name": "support", "type": "bool"},
      {"indexed": false, "internalType": "uint32", "name": "yesVotes", "type": "uint32"},
      {"indexed": false, "internalType": "uint32", "name": "noVotes", "type": "uint32"}
    ],
    "name": "Voted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "matchId", "type": "uint256"},
      {"indexed": false, "internalType": "enum MatchRegistry.Status", "name": "status", "type": "uint8"}
    ],
    "name": "MatchFinalized",
    "type": "event"
  }
] as const;

// ERC20 ABI (minimal for balanceOf check)
export const ERC20_ABI = [
  {
    "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
