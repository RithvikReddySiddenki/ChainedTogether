// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title MatchRegistry
 * @notice Manages match proposals with DAO token-gated voting and early close thresholds
 */
contract MatchRegistry {
    // =====================
    // TYPES
    // =====================

    enum Status {
        OPEN,       // 0 - Active voting
        APPROVED,   // 1 - Match approved
        REJECTED,   // 2 - Match rejected
        EXPIRED     // 3 - Deadline passed, no quorum
    }

    struct MatchProposal {
        address userA;          // Proposer
        address userB;          // Target match
        bytes32 aiScoreHash;    // keccak256(score, userA, userB, createdAt)
        bytes32 metadataHash;   // keccak256("v1", userA, userB)
        uint64 createdAt;       // Timestamp
        uint64 deadline;        // Voting deadline
        uint32 yesVotes;        // Total yes votes
        uint32 noVotes;         // Total no votes
        Status status;          // Current status
    }

    // =====================
    // STATE
    // =====================

    IERC20 public immutable daoToken;
    uint32 public immutable yesThreshold;
    uint32 public immutable noThreshold;
    uint64 public immutable voteDurationSeconds;

    uint256 public proposalCount;
    mapping(uint256 => MatchProposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    // =====================
    // EVENTS
    // =====================

    event MatchProposed(
        uint256 indexed matchId,
        address indexed userA,
        address indexed userB,
        bytes32 aiScoreHash,
        bytes32 metadataHash,
        uint64 deadline
    );

    event Voted(
        uint256 indexed matchId,
        address indexed voter,
        bool support,
        uint32 yesVotes,
        uint32 noVotes
    );

    event MatchFinalized(
        uint256 indexed matchId,
        Status status
    );

    // =====================
    // ERRORS
    // =====================

    error NotTokenHolder();
    error ProposalNotOpen();
    error VotingEnded();
    error AlreadyVoted();
    error ProposalNotExpired();
    error InvalidProposal();

    // =====================
    // CONSTRUCTOR
    // =====================

    constructor(
        address _daoToken,
        uint32 _yesThreshold,
        uint32 _noThreshold,
        uint64 _voteDurationSeconds
    ) {
        daoToken = IERC20(_daoToken);
        yesThreshold = _yesThreshold;
        noThreshold = _noThreshold;
        voteDurationSeconds = _voteDurationSeconds;
    }

    // =====================
    // EXTERNAL FUNCTIONS
    // =====================

    /**
     * @notice Proposes a new match between msg.sender and userB
     * @param userB Target match address
     * @param aiScoreHash Hash of AI score + metadata
     * @param metadataHash Hash of additional metadata
     * @return matchId The created proposal ID
     */
    function proposeMatch(
        address userB,
        bytes32 aiScoreHash,
        bytes32 metadataHash
    ) external returns (uint256 matchId) {
        if (userB == address(0) || userB == msg.sender) {
            revert InvalidProposal();
        }

        matchId = proposalCount++;
        uint64 deadline = uint64(block.timestamp) + voteDurationSeconds;

        proposals[matchId] = MatchProposal({
            userA: msg.sender,
            userB: userB,
            aiScoreHash: aiScoreHash,
            metadataHash: metadataHash,
            createdAt: uint64(block.timestamp),
            deadline: deadline,
            yesVotes: 0,
            noVotes: 0,
            status: Status.OPEN
        });

        emit MatchProposed(
            matchId,
            msg.sender,
            userB,
            aiScoreHash,
            metadataHash,
            deadline
        );
    }

    /**
     * @notice Vote on a match proposal (token-gated)
     * @param matchId Proposal ID
     * @param support true for yes, false for no
     */
    function vote(uint256 matchId, bool support) external {
        MatchProposal storage proposal = proposals[matchId];

        // Validation
        if (proposal.status != Status.OPEN) revert ProposalNotOpen();
        if (block.timestamp > proposal.deadline) revert VotingEnded();
        if (hasVoted[matchId][msg.sender]) revert AlreadyVoted();
        if (daoToken.balanceOf(msg.sender) == 0) revert NotTokenHolder();

        // Record vote
        hasVoted[matchId][msg.sender] = true;

        if (support) {
            proposal.yesVotes++;
        } else {
            proposal.noVotes++;
        }

        emit Voted(matchId, msg.sender, support, proposal.yesVotes, proposal.noVotes);

        // Check for early close
        if (proposal.yesVotes >= yesThreshold) {
            proposal.status = Status.APPROVED;
            emit MatchFinalized(matchId, Status.APPROVED);
        } else if (proposal.noVotes >= noThreshold) {
            proposal.status = Status.REJECTED;
            emit MatchFinalized(matchId, Status.REJECTED);
        }
    }

    /**
     * @notice Finalize a proposal after deadline
     * @param matchId Proposal ID
     */
    function finalize(uint256 matchId) external {
        MatchProposal storage proposal = proposals[matchId];

        if (proposal.status != Status.OPEN) revert ProposalNotOpen();
        if (block.timestamp <= proposal.deadline) revert ProposalNotExpired();

        // Determine outcome
        if (proposal.yesVotes > proposal.noVotes) {
            proposal.status = Status.APPROVED;
        } else {
            proposal.status = Status.REJECTED;
        }

        emit MatchFinalized(matchId, proposal.status);
    }

    // =====================
    // VIEW FUNCTIONS
    // =====================

    /**
     * @notice Get full proposal details
     */
    function getProposal(uint256 matchId) external view returns (MatchProposal memory) {
        return proposals[matchId];
    }

    /**
     * @notice Check if match is approved and finalized
     */
    function isMatchApproved(uint256 matchId) external view returns (bool) {
        return proposals[matchId].status == Status.APPROVED;
    }

    /**
     * @notice Check if address can vote on proposal
     */
    function canVote(uint256 matchId, address voter) external view returns (bool) {
        MatchProposal memory proposal = proposals[matchId];
        return
            proposal.status == Status.OPEN &&
            block.timestamp <= proposal.deadline &&
            !hasVoted[matchId][voter] &&
            daoToken.balanceOf(voter) > 0;
    }
}
